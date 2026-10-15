# Meshara & Udara — wedding invitation

A Next.js invitation hosted on Vercel. RSVP submissions go through `/api/rsvp` to a Google Apps Script web app, which saves them in your private Google Sheet. Guests do not sign in to Google. No service account or additional npm dependencies are required.

## 1. Create the Google Sheet and script

1. Create a blank Google Sheet in your own Google account. Keep its sharing set to **Restricted**.
2. Copy its spreadsheet ID: the part between `/d/` and `/edit` in its URL.
3. Open **Extensions → Apps Script**. Replace the default `Code.gs` with the contents of [google-apps-script/Code.gs](google-apps-script/Code.gs), then save.
4. Generate a random shared secret locally:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

5. In Apps Script, open **Project Settings → Script properties → Add script property** and add:

   | Property | Value |
   | --- | --- |
   | `SPREADSHEET_ID` | The spreadsheet ID copied above |
   | `RSVP_SECRET` | Your generated secret, at least 32 characters |
   | `SHEET_NAME` | Optional; defaults to `RSVPs` |

6. In the editor, select **initializeRsvpSheet** and click **Run**. Authorize your own script to access the spreadsheet. It creates the `RSVPs` tab and its headers. It refuses to overwrite an existing tab with incompatible headers.

The tab has seven columns: **Reply Key Hash**, **Created At (UTC)**, **Updated At (UTC)**, **Name**, **Attendance**, **Guests**, **Notes**. Keep their order and names unchanged. You can use filter views to review replies; avoid sorting or editing the data while replies are being saved. Protect the technical key column from accidental edits. Dates are stored as UTC ISO timestamps; declined replies have zero guests.

## 2. Deploy the Apps Script web app

1. Click **Deploy → New deployment**, choose **Web app**.
2. Set **Execute as: Me** and **Who has access: Anyone**. This allows Vercel to call the script without a Google login. The script checks the shared secret before accessing your sheet; the sheet itself stays private.
3. Deploy, authorize if prompted, and copy the **Web app URL** ending in `/exec`.

Use the `/exec` deployment URL, not the `/dev` testing URL. Workspace administrators can restrict anonymous web apps; use an account that allows the **Anyone** option. If you change `Code.gs` later, use **Deploy → Manage deployments → Edit → New version → Deploy** to update the deployed code.

Google references: [deploy web apps](https://developers.google.com/apps-script/guides/web), [ContentService redirects](https://developers.google.com/apps-script/guides/content), [script locks](https://developers.google.com/apps-script/reference/lock/lock-service).

## 3. Configure the invitation

Copy `.env.example` to `.env.local`, then fill in:

```dotenv
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
GOOGLE_APPS_SCRIPT_SECRET=YOUR_GENERATED_SECRET
```

`GOOGLE_APPS_SCRIPT_SECRET` must match Apps Script's `RSVP_SECRET` exactly. Keep these values in server-only settings; do not add a `NEXT_PUBLIC_` prefix, commit `.env.local`, or put the secret in the page or public files.

Start locally with `npm run dev`. On Vercel, add the same two variables in **Project Settings → Environment Variables** for the environments you use, then redeploy. A separate test Sheet and script deployment are recommended for Preview deployments so test replies stay out of your wedding guest list.

The integration reads environment variables only when someone submits, so the site still builds before configuration is available. Submissions show a custom unavailable message until setup is complete.

## Saving and editing replies

- The form sends name, attendance, guest count and optional notes. It does not collect email, phone, or meal preference.
- A random private key is created in the guest's browser and remembered before the first request. Only its hash goes to Apps Script and the Sheet. It identifies a reply independently of the name.
- A new key creates a row; the same key updates that row and preserves its original creation time. Apps Script locks lookup and write together, preventing concurrent requests for the same reply from creating duplicate rows.
- Refreshing restores the last successfully saved fields. Editing or retrying uses the same key, including when a response was lost after Google saved the row.
- A different browser or cleared storage creates a separate reply. One browser represents one reply. If browser storage is blocked, saving still works and the key lasts for the current mounted invitation/tab session; keep it open to edit.
- Confirmation appears only after Apps Script reports a successful write. Failed requests preserve the form and show custom inline errors. Replies with names that happen to match are kept separate.
- Guest text that could be interpreted as a spreadsheet formula is escaped before being written.

## Verification and troubleshooting

```sh
npm test
npx tsc --noEmit --incremental false
npm run build
```

After setup, submit a test RSVP and verify one row appears. Edit it in the same browser and confirm the same row changes. Decline and confirm the guest count becomes zero. Reload to check restoration; use an incognito browser to verify a separate reply creates a separate row.

If saving fails, check the two Vercel/local environment variables, matching Script properties, the `/exec` URL, deployment access (**Anyone**), and the Sheet's headers. Check **Apps Script → Executions** and Vercel function logs for failures. Neither endpoint logs guest replies or secrets. A deployment requiring login can return HTML rather than JSON; the invitation treats that as a failed save rather than showing a false confirmation.

For a `SAVE_FAILED` response, select **initializeRsvpSheet** in the Apps Script editor and click **Run**. This checks access and headers without adding an RSVP. The updated script returns more specific codes:

| Code | What to fix |
| --- | --- |
| `SHEET_ACCESS_ERROR` | Check `SPREADSHEET_ID` (the ID or full Sheet URL is accepted), authorize the script, and use the account that owns the Sheet. |
| `SHEET_HEADERS_MISMATCH` | Set the Script property `SHEET_NAME` to an unused name such as `RSVPs_v2`, then run `initializeRsvpSheet`. It creates the required headers without touching the old tab. |
| `CONFIGURATION_ERROR` | Set the required Script properties. |
| `UNAUTHORIZED` | Make the server secret and `RSVP_SECRET` match exactly. |
| `SCRIPT_DEPLOYMENT_ERROR` | Use the deployed `/exec` URL with execute-as **Me** and access **Anyone**. |

After copying an updated `Code.gs`, publish a **New version** through **Deploy → Manage deployments → Edit**. Saving code in the editor does not update an existing web app deployment. Local API changes need a local server restart; Vercel API changes need a fresh deployment. Guests continue to see friendly custom messages; diagnostic codes are available in API responses and server logs.

Apps Script has [execution quotas](https://developers.google.com/apps-script/guides/services/quotas). Busy requests and timeouts show a retry message; the browser keeps the reply key so a retry can update an already-written row. No automatic POST retries are issued.
