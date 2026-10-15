"""Isolated account tests: no production database and no email delivery."""
import os
import unittest
from unittest.mock import patch

os.environ['DATABASE_URL'] = 'sqlite://'
os.environ['JWT_SECRET_KEY'] = 'manual-account-tests-only-not-a-production-secret'

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.api import deps
from app.api.routes import auth, users
from app.core.security import hash_password, verify_password, create_access_token
from app.db.session import Base
from app.db.migrations import run_startup_migrations
from app.models import user, voucher, document, disposal, asset, asset_voucher, notification, sla_config, department, station
from app.models.user import User


class ManualAccountTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.session = sessionmaker(bind=self.engine)()
        self.admin = User(email='admin@icttoolsasm.com', role='ADMIN', password=hash_password('Admin-password-123'), is_active=True)
        self.session.add(self.admin)
        self.session.commit()
        self.app = FastAPI(dependencies=[Depends(deps.require_password_change_completed)])
        self.app.include_router(auth.router, prefix='/auth')
        self.app.include_router(users.router, prefix='/users')

        @self.app.get('/work')
        def work():
            return {'ok': True}

        def test_db():
            yield self.session

        self.app.dependency_overrides[deps.get_db] = test_db
        self.app.dependency_overrides[users.get_db] = test_db
        self.client = TestClient(self.app)
        self.headers = {'Authorization': 'Bearer ' + create_access_token(self.admin.email)}
        self.email_patch = patch('app.api.routes.users.send_welcome_email')
        self.send_email = self.email_patch.start()

    def tearDown(self):
        self.client.close()
        self.email_patch.stop()
        self.session.close()
        self.engine.dispose()

    def create_account(self, **overrides):
        return self.client.post('/users/create-user', headers=self.headers, json={
            'email': 'new@icttoolsasm.com', 'username': 'new.user', 'full_name': 'New User',
            'role': 'USER', 'delivery_method': 'manual', **overrides,
        })

    def test_manual_creation_persists_hash_without_smtp_and_does_not_expose_password_again(self):
        response = self.create_account()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['cache-control'], 'no-store')
        details = response.json()
        self.send_email.assert_not_called()
        saved = self.session.query(User).filter_by(email=details['email']).one()
        self.assertTrue(verify_password(details['temporary_password'], saved.password))
        self.assertNotEqual(saved.password, details['temporary_password'])
        self.assertTrue(saved.must_change_password)
        directory = self.client.get('/users/', headers=self.headers).json()
        self.assertNotIn(details['temporary_password'], str(directory))
        self.assertNotIn('temporary_password', str(directory))
        duplicate = self.create_account()
        self.assertEqual(duplicate.status_code, 400)
        self.assertNotIn('temporary_password', duplicate.json())

    def test_first_login_is_restricted_until_a_different_password_is_saved(self):
        details = self.create_account().json()
        login = self.client.post('/auth/login', json={'email': details['email'], 'password': details['temporary_password']})
        self.assertEqual(login.status_code, 200)
        self.assertTrue(login.json()['user']['must_change_password'])
        headers = {'Authorization': 'Bearer ' + login.json()['access_token']}
        self.assertEqual(self.client.get('/work', headers=headers).status_code, 403)
        self.assertEqual(self.client.get('/users/', headers=headers).status_code, 403)
        self.assertTrue(self.client.get('/auth/me', headers=headers).json()['must_change_password'])
        for old, new, status in [
            ('incorrect', 'A-new-password-123', 400),
            (details['temporary_password'], details['temporary_password'], 400),
            (details['temporary_password'], 'short', 422),
        ]:
            result = self.client.post('/auth/change-password', headers=headers, json={'current_password': old, 'new_password': new})
            self.assertEqual(result.status_code, status)
        changed = self.client.post('/auth/change-password', headers=headers, json={
            'current_password': details['temporary_password'], 'new_password': 'A-new-password-123',
        })
        self.assertEqual(changed.status_code, 200)
        self.assertFalse(changed.json()['user']['must_change_password'])
        self.assertEqual(self.client.get('/work', headers=headers).status_code, 200)
        self.assertEqual(self.client.post('/auth/login', json={'email': details['email'], 'password': details['temporary_password']}).status_code, 401)
        self.assertEqual(self.client.post('/auth/login', json={'email': details['email'], 'password': 'A-new-password-123'}).status_code, 200)

    def test_only_it_or_admin_can_create_and_duplicate_username_is_rejected(self):
        self.assertEqual(self.client.post('/users/create-user', json={'email': 'new@icttoolsasm.com', 'delivery_method': 'manual'}).status_code, 401)
        self.assertEqual(self.create_account(username=self.admin.username or 'admin-name').status_code, 200)
        self.assertEqual(self.create_account(email='other@icttoolsasm.com', username=self.admin.username or 'admin-name').status_code, 400)
        regular = User(email='regular@icttoolsasm.com', role='USER', password=hash_password('Regular-password-123'), is_active=True)
        self.session.add(regular)
        self.session.commit()
        response = self.client.post('/users/create-user', headers={'Authorization': 'Bearer ' + create_access_token(regular.email)}, json={'email': 'third@icttoolsasm.com', 'delivery_method': 'manual'})
        self.assertEqual(response.status_code, 403)

    def test_existing_accounts_are_not_forced_to_change_until_admin_resets_password(self):
        self.assertFalse(self.client.get('/auth/me', headers=self.headers).json()['must_change_password'])
        details = self.create_account().json()
        saved = self.session.query(User).filter_by(email=details['email']).one()
        saved.must_change_password = False
        self.session.commit()
        reset = self.client.patch(f'/users/{saved.id}/reset-password', headers=self.headers, json={'new_password': 'Reset-password-123'})
        self.assertEqual(reset.status_code, 200)
        self.assertTrue(saved.must_change_password)

    def test_email_delivery_remains_available_without_returning_a_plaintext_password(self):
        response = self.create_account(delivery_method='email')
        self.assertEqual(response.status_code, 200)
        self.send_email.assert_called_once()
        self.assertNotIn('temporary_password', response.json())

    def test_migration_preserves_existing_users_and_is_idempotent(self):
        legacy = create_engine('sqlite://')
        with legacy.begin() as connection:
            connection.execute(text('CREATE TABLE users (id INTEGER PRIMARY KEY, role VARCHAR)'))
            connection.execute(text("INSERT INTO users (id, role) VALUES (1, 'it')"))
        run_startup_migrations(legacy)
        run_startup_migrations(legacy)
        with legacy.connect() as connection:
            row = connection.execute(text('SELECT role, must_change_password FROM users WHERE id=1')).one()
            self.assertEqual(tuple(row), ('IT', 0))
        legacy.dispose()


if __name__ == '__main__':
    unittest.main()
