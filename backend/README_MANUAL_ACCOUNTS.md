# Manual account invitations

The frontend creates accounts with `delivery_method: "manual"` through the
IT/admin-only `POST /users/create-user` endpoint. SMTP is not required for this
mode, and no automatic email is sent.

The creation response includes the email, username, and generated temporary
password. The admin copies these from the confirmation dialog and emails them
to the intended user. Closing the dialog discards the plaintext credentials;
the database stores only the password hash. User list and session responses
never include the temporary password. Use Reset Password if the details were
lost before delivery.

New accounts must change their temporary password at first sign-in. Login and
`GET /auth/me` expose `must_change_password`; the frontend redirects such users
to `/change-password`. `POST /auth/change-password` verifies the current
password and saves a different password with at least eight characters.
Authenticated API requests are blocked until that change is complete.

Startup migrations add `users.must_change_password` with a false default, so
existing accounts keep working. New manual or email invitations and admin
password resets set this flag to true.

The default API delivery mode remains `email` for compatibility. Explicit email
delivery still requires SMTP and rolls back account creation if sending fails.
Organization email and IT/admin access requirements remain in force.

Deploy this backend together with the updated `Leslyndizeye/murif` frontend.
The backend source is available in this repository's `MURI Project/backend`
directory and as a copy under `backend` in `Leslyndizeye/murif`. Render must
use the matching backend root directory for its connected repository.
Netlify continues to build the frontend from the `murif` repository root.

Run the isolated regression tests from the backend directory:

```powershell
.venv/Scripts/python.exe -B -m unittest discover -s tests -v
```

Tests use an in-memory database and mock email delivery. They do not access the
configured database or send any email.
