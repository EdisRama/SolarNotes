# Solar Notes

Solar Notes is a Vite, vanilla JavaScript, and Three.js note system. Notes, tasks, categories, and calendar events are stored in a private Supabase row and synchronized when you sign in on another device. Browser storage remains as a local cache.

## Run locally

1. Install Node.js 20.19+ or 22.12+.
2. Install project dependencies with `npm install` (`npm.cmd install` works in PowerShell when script execution is restricted).
3. Configure Supabase as described below and copy `.env.example` to `.env.local`.
4. Run `npm run dev` (`npm.cmd run dev` in PowerShell), then open the local URL Vite prints.

## Configure private cloud login

The free setup uses GitHub Pages for the static site and Supabase Free for email/password authentication and storage. Free tiers have quotas and can change; neither service promises uninterrupted 24/7 availability.

1. Create a Supabase project on the free plan.
2. In **Project Settings → API**, copy the Project URL and the publishable key (or legacy `anon` key). Put them in `.env.local`:

   ```dotenv
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-public-publishable-or-anon-key
   ```

   These are browser-visible public values. Never put a `service_role` or secret key in this app or in a `VITE_` variable.
3. In the Supabase SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql). It creates the user-owned data table and enables row-level security so authenticated users can only read or change their own row.
4. In **Authentication → Providers → Email**, keep email/password enabled. Turn off public sign-ups in the project's authentication settings. Add your own account from **Authentication → Users → Add user**; confirm its email if Supabase requests it. There is intentionally no sign-up form in Solar Notes.
5. Start the app and sign in with that email and password. On first sign-in, any notes already stored for this app origin are copied to the empty cloud account. If the cloud row already exists, that row replaces the browser cache.

If your old notes are only in the previous localhost site, export them there first (**Datahantering → Exportera**), then sign in to the hosted site and import that JSON file. Browser storage is isolated by website address, so a GitHub Pages site cannot read localhost storage automatically.

Keep the Supabase project and its database active. The public GitHub Pages site only serves the app; row-level security isolates data by signed-in user. Online access is required for cloud sync.

## Publish for access from your other devices

1. Create a GitHub repository and upload the project files. Do not upload `.env.local` or exported `solar-notes-*.json` backups.
2. In the repository, open **Settings → Secrets and variables → Actions** and add repository secrets named `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, using the values from your local `.env.local`.
3. Open **Settings → Pages** and choose **GitHub Actions** as the build and deployment source.
4. Push to the `main` branch. [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) builds and deploys the site automatically. GitHub displays the resulting URL in **Settings → Pages**.
5. Open that URL on another device and log in with the same account. Both devices use the same cloud data row.

No paid domain, subscription, backend server, or GitHub credential is needed in the application. The repository can be public because the app contains no private data or Supabase secret key; the database policies are what prevent other accounts from accessing your notes.
