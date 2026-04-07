# Secrets

These files are read by Docker Compose at deploy time and mounted read-only
inside the container at `/run/secrets/<name>`. They are **never** baked into
the image.

> This directory and its contents are listed in `.gitignore` — never commit
> secret files to source control.

## Files required for production (`docker-compose.prod.yml`)

| File | Contains |
|---|---|
| `database_url.txt` | Full Postgres connection string |
| `postgres_password.txt` | Password for the Postgres `app_user` account |
| `openai_api_key.txt` | OpenAI API key |
| `anthropic_api_key.txt` | Anthropic API key |
| `gemini_api_key.txt` | Google Gemini API key |

## How to create them on the VM

```sh
mkdir -p secrets
echo "postgres://app_user:YOURPASSWORD@postgres:5432/app_db" > secrets/database_url.txt
echo "YOURPASSWORD"   > secrets/postgres_password.txt
echo "sk-..."         > secrets/openai_api_key.txt
echo "sk-ant-..."     > secrets/anthropic_api_key.txt
echo "AIza..."        > secrets/gemini_api_key.txt
chmod 600 secrets/*.txt
```

The `database_url.txt` password must match `postgres_password.txt`.
