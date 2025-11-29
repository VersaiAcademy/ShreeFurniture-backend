## Security: rotate exposed keys and remove them from Git

You had secrets committed to the repository. Follow these steps immediately:

1) **Rotate all exposed credentials now**
   - MongoDB connection string (change DB user password or create a new user)
   - BREVO_API_KEY
   - CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
   - CASHFREE_SECRET_KEY / CASHFREE_APP_ID
   - Any other API keys shown in the repo

2) **Remove the secrets from the repository**
   - We replaced the committed `.env` with placeholders. The keys may still exist in Git history.
   - To remove them from history, use `git filter-repo` or `bfg` (recommended):

     Using `git filter-repo` (recommended):
     ```bash
     pip install git-filter-repo
     git clone --mirror <REPO-URL> repo.git
     cd repo.git
     git filter-repo --invert-paths --paths .env
     git push --force
     ```

     Using BFG:
     ```bash
     # Install bfg and run
     bfg --delete-files .env
     git reflog expire --expire=now --all && git gc --prune=now --aggressive
     git push --force
     ```

   - NOTE: Rewriting git history affects all collaborators. Coordinate with your team.

3) **Add `.env` to `.gitignore`**
   - `.gitignore` already contains `.env` in this repo. Ensure it remains.

4) **Store secrets in the deployment platform**
   - Use Render / Railway / Vercel environment variables UI to store keys securely.
   - Do not check them into source control.

5) **Test after rotation**
   - Update environment variables in the deployment platform with rotated keys.
   - Run `node utils/testEmail.js` locally (with your real env) or deploy and test.

If you want, I can help create a small script to detect other files containing secrets and prepare a cleanup plan.
