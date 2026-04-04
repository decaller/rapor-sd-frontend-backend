# secrets/

Place your Google Service Account JSON key here:

```
secrets/google-service-account.json
```

This file is bind-mounted into the backend container at runtime.
It is **never** committed to git — `secrets/*.json` is in `.gitignore`.

See the root `README.md` → **Credential Setup** section for instructions.
