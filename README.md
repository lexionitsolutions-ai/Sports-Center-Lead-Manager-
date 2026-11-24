# Sports Center workspace

The refreshed interface opens administrators on **Overview**. Its five primary destinations are **Overview, Inquiries, Follow-ups, Service & AMC, Quotations**, shown in a fixed bottom navigation bar with space reserved for device safe areas. The top-left three-dot menu contains secondary tools; Machinery database is the last item. Technicians retain their service-only navigation. The menu supports Escape, focus containment and focus restoration. The refined red-and-black SC logo is used in the header, login, menu, favicon and touch icon; its source asset and generation notes are in `public/brand/`.

Responsive React application for sales, dated follow-ups, gym service / AMC, and school and college equipment deliveries. Frontend: Vite + React. Backend: Supabase Auth + PostgreSQL with row-level security. Ready for Vercel.

## Run locally

Requires Node.js 22 or later.

```sh
npm install
npm run dev
```

On Windows PowerShell with script execution disabled, use `npm.cmd` instead of `npm`.

Without environment variables the application opens a **demo workspace**. It includes fictional sample records and saves edits and uploaded photos in this browser's IndexedDB database. The sidebar role selector previews admin and technician screens; demo mode is not authentication. Do not put real customer data in demo mode. Sample data is never inserted into Supabase. Clear the `sports-center-workspace` IndexedDB database in browser developer tools to reset demo data. Old local-storage records migrate automatically on first load.

## Connect Supabase

1. Create a Supabase project. Run [supabase/schema.sql](supabase/schema.sql) once in its SQL Editor against a new database, then run [supabase/quotations.sql](supabase/quotations.sql) and [supabase/machinery-database.sql](supabase/machinery-database.sql), in that order. Then apply `supabase/followups.sql`, `supabase/whatsapp-agent.sql`, and `supabase/staff-accounts.sql`. Inspect existing tables before choosing migrations for an existing database.
2. Create each team member in **Authentication → Users**. Disable public sign-ups in Auth settings; this is an invitation-only internal workspace.
3. Sign in using your phone number and password, then open **Staff accounts** to create team members with the `admin` or `technician` role. The server verifies the current administrator and provisions the protected profile. The same sign-in page routes people according to their assigned role.
4. Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the project's URL and browser-safe publishable/anon key. Never use the service-role or secret key in the frontend.
5. Restart the dev server. Sign in with a provisioned account. Live mode starts with empty tables; add your real gyms and inquiries.

Admins can manage inquiries, outcomes, collected sales, gym contracts, visits and deliveries. Technicians can read the gym directory, insert visits attributed to their authenticated user ID and see their own visit history. RLS enforces these limits in the database; hiding navigation is not the security boundary. Visits are append-only for technicians. Admins see all visit history. There is no account signup flow or role switch in live mode. Password recovery is handled by the administrator through Supabase Auth.

## Workflows

- Inquiry creation has four primary fields: name, number, reason dropdown, calendar follow-up date. Choosing Other opens a required specification field.
- Follow-ups are filtered by exact calendar day, with previous/next day controls and a separate overdue list. Update notes, follow-up status and next date. Converted and Not interested inquiries leave the call list; closed deals remain in the inquiry register.
- Sales collected is the amount received entered on converted inquiries, summed across all time. It is not projected pipeline value. Service collected sums chargeable visit payments. Delivery values are tracked separately and are not double-counted as sales.
- Add gyms and their renewal dates. Log monthly AMC or machinery repair visits; select a common repair or describe another. Enter service date, coverage, amount received if chargeable, and renewal date. The visit renewal is a historical snapshot; admins edit the authoritative gym contract in Manage. Technicians cannot edit contracts. The directory's last-visit information in technician mode reflects only their own visible visits.
- Track institutions, head/contact number, equipment and quantities, delivery date, and equipment value. Repeated deliveries to the same school are supported.
- Dates and overdue/renewal calculations use India business time. All financial totals are INR. No deletion buttons are provided to prevent accidental loss of operational history.
- CSV export includes all inquiries, even when the screen is filtered. Formula-like cell values are escaped for spreadsheet safety.

## Verify and deploy

A deliberately hosted demo can set `VITE_DEMO_PREVIEW=true` in Vercel while both Supabase variables are absent. It displays a persistent demo notice and saves only in the visitor's browser. Remove that flag when configuring the real Supabase URL and public key; partial live configuration is rejected by the build guard. Hosted demo mode does not connect WhatsApp or provision the database.

```sh
npm test
npm run build
```

Import this repository into Vercel with the **Vite** framework preset. Use build command `npm run build` and output directory `dist`. Add the two `VITE_SUPABASE_*` variables to the Vercel project's environment, then deploy. Rebuild after changing these variables, as Vite embeds public configuration at build time. Add your Vercel URL to Supabase Auth's site URL configuration. No credentials or hosted projects are bundled in the repository.

Before production, verify RLS using two separate real accounts: the technician must not read inquiries/deliveries, change gyms or profiles, or read other technicians' visits. An admin must see all records. Database integration requires an actual Supabase project; the included unit tests cover business rules, not live RLS execution.

References: [Supabase password sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [Supabase user data and RLS](https://supabase.com/docs/guides/auth/managing-user-data), [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite).

## Machinery database and Quotation Maker

Admins start in **Machinery database**. Add each machine with a photo, category, length, breadth, height, dimension unit, MRP, and specifications or included accessories. Upload JPG, PNG or WebP photos from your device; the app compresses them for storage. An HTTPS photo link is also available. Categories include Back, Biceps, Chest, Triceps, Shoulders, Abs, Legs, Dumbbells, Racks, Benches, Cardio and Accessories. Search ignores spaces and hyphens. Catalog pages show 24 machines at a time; Supabase loading retrieves all pages rather than stopping at 1,000 records.

Open **Quotation Maker** and press **+ New quotation**. Three dialogs collect the gym name and required WhatsApp number, let you add machinery consecutively, then show a pricing table. Repeated additions increase quantity. New lines use a tentative MRP of **₹1,00,000 per unit**, including catalog models marked price on request; this does not change catalog prices or existing quotations. Enter discounted prices individually or apply a percentage to every line's MRP (35% gives ₹65,000 per unit). Reapplying a percentage does not compound it. Quantities and individual prices remain editable. Save quotations to keep them across reloads; saved lines capture their own equipment details, prices and photos.

The Sports Center PDF names the customer's gym and WhatsApp number, lists machinery, MRP, discounted price, quantity and line totals, and includes total MRP, total discount and machinery subtotal. It displays **GST 18%** without a separate tax amount, **Transportation: As actual**, and a final total including GST. Transportation is separate. The quotation is signed by Mayuri Pathak. Press **Prepare PDF** to enable preview, download and WhatsApp sharing. Supported devices share the PDF through their native share menu; choose WhatsApp and the intended customer. **Download & open WhatsApp** downloads the PDF and opens the entered customer's chat with a prepared message; attach the downloaded PDF and send it there. Browser WhatsApp links cannot attach a local PDF or automatically send it. No server-side quotation sending is configured by this flow.

Demo mode stores records and photos in IndexedDB on this device. Existing local-storage demo records migrate automatically. Sample prices, dimensions and specifications are fictional. The sample lat pulldown photo is by Teddyhtsai, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Diverging_Lat_Pulldown_Machine.jpg), CC0 1.0; other sample images are illustrative. Replace sample content with your own equipment information.

For live mode, apply `supabase/quotations.sql` once if quotation tables do not exist, then `supabase/machinery-database.sql`. The latter adds structured dimensions, specifications, categories and the `machinery-photos` Storage bucket. Admin-only RLS protects catalog records, quotations and uploads. Equipment photos in this public bucket can be viewed by anyone with the image URL. The live catalog starts empty. Migration and live RLS/Storage behavior require verification against your actual Supabase project.

## Follow-up outcomes and WhatsApp previews

Follow-up status can be New, Call done, Interested, Call not received, Not interested, Converted or Quoted. Pastel labels identify each outcome, including on mobile. Active inquiries require a next date and appear only in that day's scheduled list; changing the date moves them immediately. Not interested and Converted close the inquiry and clear its next date. Converted means bought from Sports Center; enter the amount collected for the sales dashboard. Closed inquiries remain in the inquiry register and can be reopened there. Existing Contacted/Won/Lost records normalize to Call done/Converted/Not interested without losing collected amounts.

After a new inquiry saves successfully, an editable WhatsApp preview opens with a message tailored to Gym machinery, Professional gym setup, Home gym setup, School equipment, Sports equipment or Other. Templates introduce Mayuri Patil as requested for WhatsApp; the quotation signatory remains Mayuri Pathak. Each message thanks the customer for enquiring at Sports Center, describes the relevant service, lists category-specific previous-work examples explicitly labeled as demos, asks for useful requirements and closes with an invitation to work together. No templates mention Zenith Fitness. Instagram links can be added later. Copy or edit the text, or open WhatsApp with the customer's number and prefilled message. The customer message is sent only when the administrator presses Send in WhatsApp. Existing inquiry rows have a WhatsApp preview button to reopen the message later.

Existing Supabase workspaces must run `supabase/followups.sql` to migrate statuses, allow closed inquiries without a follow-up date and add the Professional gym setup reason. New databases have these rules in `schema.sql`. RLS remains admin-only for inquiries; live migrations require an actual connected Supabase project.

## WhatsApp follow-up agent

The source repository is https://github.com/lexionitsolutions-ai/Sports-Center-Lead-Manager-. Clone it with `git clone --recurse-submodules` to retrieve the pinned Evolution Go dependency. For an existing clone, run `git submodule update --init --recursive` before using Docker Compose.

The **WhatsApp agent** page adds an administrator-only conversation inbox, explicit inquiry enrolment with a permission record, a daily follow-up time, customer replies, callback/review tasks, manual replies, takeover and opt-outs. Demo mode simulates conversations without sending messages or changing inquiry dates. The first release uses guided English responses, not an LLM: it collects requirements, proposes and confirms dates, and hands pricing, quotations, attachments and callback requests to Mayuri. It does not invent prices, generate quotations in chat, transcribe voice notes, promise delivery or mark a sale Converted.

The backend runs continuously outside Vercel. It stores incoming events and outgoing messages in Supabase and uses the cloned Evolution Go 0.7.3 source in `evolution-go-source` (commit `80d7c72c0727e091425d10f5654b7ccf07e01abe`). Evolution Go is the WhatsApp transport; it is distinct from Meta's official WhatsApp Business Platform. Its license activation and linked-device connection must remain operational. Preserve its license notices and the attribution shown in the agent page.

### What you need to connect

1. A live Supabase project and a provisioned Sports Center administrator. Apply `supabase/whatsapp-agent.sql` **once**, after the existing schema and follow-up migration. It creates seven agent tables and controlled RPCs. Technicians cannot read conversations or invoke worker functions.
2. An always-on server with Docker Compose, outbound internet, and persistent storage. Put this workspace, including `evolution-go-source`, on that server. Your Vercel frontend stays separate. The supplied Compose setup runs Evolution, its own PostgreSQL database and the agent; Supabase remains your CRM database.
3. A licensed, activated Evolution installation and the WhatsApp Business number Mayuri will link using **Linked Devices**. Start with a test business number. Verify that she can continue using her iPhone and that outgoing phone messages pause the agent. A phone model does not provide access to normal SIM-call events.
4. Server environment values from `.env.agent.example`: Supabase project URL and **service-role/secret key**, Evolution **instance token and instance ID**, plus a random webhook secret. Docker also needs distinct Evolution administrator and database secrets. Put secrets directly in your server environment; do not send them in chat or put them in Vercel's `VITE_*` variables.

Copy `.env.agent.example` to `.env.agent` (git-ignored). Generate a separate value for each secret using:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use hex for the Compose database password so it is safe in its connection URL. Keep `AGENT_SEND_ENABLED=false` initially. The first Compose start can use placeholder instance token/ID values while you obtain the real ones; do not enable sending with placeholders.

```sh
docker compose --env-file .env.agent -f compose.agent.yaml up -d --build
```

Evolution auto-creates its two databases inside the dedicated PostgreSQL container. The Manager is at `http://127.0.0.1:8080/manager/login` on that server. For a remote server, use an SSH tunnel or an authenticated HTTPS reverse proxy to access it. Sign in with your API URL and the configured Evolution global administrator key, complete license activation, create **one** instance, and pair the test WhatsApp number. Copy that instance's ID and token into `.env.agent`, then recreate the agent container. Docker commands and Evolution builds require validation on your actual host; Docker is not available in this development environment.

Set the **instance-specific** webhook in Evolution Manager to:

```text
http://agent:8787/webhooks/evolution/<AGENT_WEBHOOK_SECRET>
```

Subscribe to `MESSAGE`, `SEND_MESSAGE` and `CALL` events. Keep Evolution's global webhook empty and its `rejectCall` setting **false**: rejecting calls immediately would prevent Mayuri answering them. Keep `WEBHOOK_FILES=false` to avoid sending large base64 attachments; attachments create review tasks instead. The webhook URL above uses the private Compose network. For separately hosted services, use an HTTPS URL with the same path. Redact that secret path from proxy/access logs.

For a backend without Docker, use Node 22+ and a separately configured Evolution server:

```sh
npm ci
npm run agent
```

On Windows PowerShell, use `npm.cmd`. Set `EVOLUTION_URL` to the actual Evolution origin. The worker listens on port 8787 and exposes `/health`; HTTPS termination and ingress limits belong at your reverse proxy. The webhook accepts only the configured instance and a 32+ character secret path, commits events before acknowledging them, and does not store raw payloads or instance tokens. Only the backend has the service-role key. Back up the Evolution PostgreSQL volume and your Supabase data; do not remove database volumes during routine upgrades.

### Pilot and enable

1. Deploy the updated frontend. Open **WhatsApp agent** as an administrator. Its status should show a live worker with sending disabled. Enable automation to inspect queued work while the environment send switch is still false. Manual messages also remain queued with that switch off.
2. Enrol one test inquiry, record the customer's actual permission, and choose a follow-up date. Follow-ups send once per inquiry/date from the configured time (default 10 am) until 6 pm **Asia/Kolkata**. Overdue dates are not automatically messaged. Dates and closed statuses continue to be edited in the existing inquiry/follow-up screens.
3. Check queued messages in the conversation. Clear or review any test work before enabling real sending. Set `AGENT_SEND_ENABLED=true`, recreate/restart the agent, and verify the dashboard says sending permitted. Enabling this switch permits any still-valid queued manual or automatic messages to send.
4. Verify a due follow-up, an incoming reply, `contact me tomorrow` followed by `YES`, `call me`, `STOP`, a manual reply and takeover/resume. Customer replies cancel queued automated messages; a reply earlier that same day suppresses that day's follow-up. Dates change only after confirmation. `Not interested` ends follow-ups without overwriting a Converted sale. `STOP` is applied even while automation is paused. Re-enrolling an opted-out customer is blocked pending a new consent review.
5. Test duplicate webhook delivery and restarting the worker. Uncertain sends are **not automatically retried**. Check WhatsApp before composing another reply. `Sent to WhatsApp` records a successful send acknowledgement, not customer delivery or a read receipt. Pausing cannot recall a request already in flight.

The queue claims one job atomically, checks conversation revisions and current inquiry state before sending, and cancels stale jobs after takeover, replies, date changes or closure. Keep the server clock synchronized. The UI refreshes agent history every 10 seconds; use **Refresh** to also reload inquiry dates changed by the assistant. It shows the latest 200 conversations and the selected conversation's latest 100 incoming and 100 outgoing messages.

### Missed calls

Leave **Missed-call replies** off until live tests confirm the exact call events from your paired iPhone. Evolution call offers, acceptance and termination are correlated by call ID. Only explicit `timeout`/`missed` termination outcomes qualify, after a 30-second grace period; an acceptance event suppresses a reply. Repeat missed-call replies are limited to one per customer per hour. Unknown call outcomes are ignored. Only contacts with recorded messaging permission and an active assistant qualify; an ordinary missed call does not establish that permission.

**Normal SIM calls on the iPhone require a business telephony provider.** The implementation includes a bridge endpoint, not a completed provider-specific integration. Select a provider that can ring/forward to Mayuri, report the original caller number and distinguish missed from answered calls. Your bridge must verify the provider's native webhook signature and send:

```http
POST /webhooks/telephony
X-Agent-Timestamp: <Unix seconds>
X-Agent-Signature: <hex HMAC-SHA256 of timestamp + "." + exact raw JSON bytes>
Content-Type: application/json

{"id":"unique-provider-call-id","event":"call.missed","phone":"+919876543210","occurredAt":"2026-11-23T05:00:00Z"}
```

Use the separate `TELEPHONY_WEBHOOK_SECRET`. Events/signatures older than five minutes are rejected and call IDs are deduplicated. Expose this endpoint over HTTPS only when a verified bridge is ready. The same dashboard missed-call switch and consent checks apply. No SIM-call monitoring or iPhone app has been installed.

Run `npm test` and `npm run build` before deployment. Tests include an isolated PostgreSQL runtime for migration execution, RLS, queue claims, date confirmation, opt-outs, event deduplication and call suppression, plus transport and webhook tests. Live Supabase, Evolution activation/pairing, Docker and end-to-end phone behavior still require the pilot above.


## Phone sign-in and staff accounts

Production app: https://sports-center-lead-manager.vercel.app. Database project: `lroqwihqwazhdnksgqvy`. The live workspace starts empty; demo records were not inserted.

People sign in with a 10-digit Indian phone number (or an international number prefixed with +) and their password. Numbers normalize to one account. Internally, a reserved `.invalid` email identifier lets Supabase password authentication work without collecting an email address or configuring SMS. That internal identifier is not a real inbox; email reset links are not available. Passwords are handled by Supabase Auth and are never stored in the profiles table or repository.

Administrators open **Staff accounts**, enter the person's name, phone, initial password and access level, then create the account. Technicians see the gym directory and their own service visits. Administrators have full business and staff-management access. Share initial credentials privately. There is no self-registration or client-side role assignment.

Apply `supabase/staff-accounts.sql` after the existing migrations and deploy the `staff-accounts` Edge Function from `supabase/functions/staff-accounts/index.ts`, including `shared/staff-domain.js` with the same relative directory layout. The function authenticates the bearer token with Supabase Auth and independently checks the caller's administrator profile. Gateway JWT verification is disabled because the function performs these checks itself. Public requests are rejected. It uses its built-in server-only service-role environment key; that key must never enter the frontend.

Trusted Auth Admin API metadata provisions a profile when the user is created or metadata is applied. Unprovisioned Auth accounts have no workspace role and cannot access business records. Public signup cannot supply administrator-controlled app metadata. Existing administrator password resets require a trusted server-side Auth Admin API operation; no email-based recovery is exposed. The initial one-use administrator bootstrap endpoint has been replaced by the authenticated staff-only function.


## Aerofit Aero Power catalog import

The live machinery database includes a starter selection of 19 Aero Power Series models from the manufacturer listing at https://aerofit.co/product-category/commercial-strength/?pa-series=147, retrieved on 23 November 2026: three each for Chest, Back, Shoulders, Abs and Legs, and two each for Biceps and Triceps. Dual-purpose machines have one primary catalog category; their full exercise names remain visible. Product descriptions are concise summaries, with published dimensions and weight stacks preserved. An inconsistent muscle-target label on AF-4819 was omitted and noted. Two listings without usable specifications were replaced by documented models.

Apply `supabase/migrations/20261123174342_aerofit_catalog_metadata.sql` to an older database before importing. The migration adds brand, series, model code, source URL and a price-on-request flag while preserving admin-only catalog RLS. Unique source/model indexes prevent duplicate imports. The source manifest is `data/aerofit-aero-power.json`.

The selected pages publish no retail prices, so these models display **Price on request**. Their zero numeric placeholders are not confirmed prices. New quotation lines currently use the explicitly requested tentative ₹1,00,000 MRP without changing the machinery database. Saving a positive MRP clears the flag. Images are copied into the existing Supabase `machinery-photos` bucket, avoiding dependence on manufacturer hotlinks and supporting quotation photo downloads.

To rerun the import, set `SPORTS_CENTER_IMPORT_PHONE` and `SPORTS_CENTER_IMPORT_PASSWORD` in the process environment, ensure the ignored `.env.local` contains the public Supabase configuration, then run `node scripts/import-aerofit.mjs`. Use an administrator account. Existing source/model matches are skipped and their edits are preserved. Never commit credentials. No prices, dimensions or accessories are guessed when missing from the source.
