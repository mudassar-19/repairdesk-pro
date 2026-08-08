# RepairDex Pro — Complete Business Guide

*A plain-language walkthrough of how the system works, written for shop owners and staff — not for programmers. Every screen and every step is explained the way you actually use it.*

---

## 1. What this app is

RepairDex Pro is an **offline-first desktop program** for a mobile repair shop. It runs on your computer (Mac/Windows). It keeps records of your customers, repair jobs, money coming in, money going out, and money owed — all in one place, and shows you your profit at a glance.

- **Offline-first** means it works even without internet. Your data lives on your own computer. The internet is only used for two things: logging in, and (optionally) backing up to Google Drive.
- The whole app is **bilingual** — every label appears in **English and Urdu (اردو)** together.
- The app opens on the **Dashboard**, and a menu on the left (the sidebar) lets you jump between the ten sections.

**The ten sections (left sidebar):**

| Menu item | What it's for |
|---|---|
| Dashboard | Today's summary and money overview |
| Customers | Your customer list and their history |
| Repairs | Repair jobs (the heart of the app) |
| Payments | A ledger of every payment received |
| Expenses | Money you spend (rent, salary, parts, etc.) |
| Udhaar (اُدھار) | Money owed to you, and money you owe |
| Reports | Profit/loss report for any period, printable as PDF |
| Analytics | Trend charts (revenue, profit, customers, brands) |
| Activity | A running log of everything that happened |
| Settings | Shop branding, receipt text, backups, logout |

---

## 2. The big picture — how the modules connect

The most important thing to understand: **the modules are not separate islands. One action ripples into others.** Here is the flow of a normal job and how the money moves:

```
   CUSTOMER
      │  (you create/pick a customer)
      ▼
   REPAIR JOB  ── the Advance you take at booking is itself a PAYMENT
      │            (so it counts as Revenue right away)
      │
      │  At delivery you pick ONE of:
      ├──► "Mark as Delivered"  → records the WHOLE remaining balance as a
      │                            PAYMENT, then delivers  ─► counts as REVENUE
      │
      └──► "Deliver on Credit"  → part (or none) paid now as a PAYMENT,
                                   the rest becomes ─► UDHAAR (Receivable)
                                                          │
                                   (when the customer pays it off later,
                                    "Record Settlement" turns it into a
                                    PAYMENT on that repair) ─► counts as REVENUE

   Every rupee that enters the shop is a PAYMENT — advance, delivery, or
   settlement — so nothing is ever collected without being recorded.

   PAYMENTS ─► REVENUE and PROFIT ─► shown on DASHBOARD / REPORTS
   EXPENSES ─► subtracted from profit to give NET PROFIT
```

**In one sentence:** Customers get Repair jobs → every rupee received (advance, delivery payment, or a settled Udhaar) is recorded as a Payment → Expenses are logged → and the Dashboard and Reports add it all up into Revenue, Profit, and Net Profit — updating **live**, with no manual refresh.

---

## 3. Key money words, explained simply

Before the flows, here are the terms the app uses. Understanding these removes 90% of confusion.

| Term | Plain meaning |
|---|---|
| **Cost Price** | What the repair cost *you* (parts, etc.). |
| **Repair Price** | What you charge the *customer* for the repair. |
| **Advance** | Money taken up front, at the time the job is booked. It is recorded as a real **Payment**, so it counts toward Revenue immediately. |
| **Remaining Balance** | What the customer still owes = **Total Price − all Payments received** (the advance is one of those payments). |
| **Payment** | Money received from a customer, recorded through the app. |
| **Revenue** | Total money actually *received* (the sum of Payments). |
| **Profit** | Your margin on the money received = Payment × (Repair Price − Cost Price) ÷ Repair Price. In short, only the money you've actually collected earns profit, and only your markup (not the parts cost) counts as profit. |
| **Expenses** | Money you spent running the shop (rent, salary, parts, etc.). |
| **Net Profit** | Profit − Expenses. This is your real bottom line. |
| **Udhaar — Receivable (کل وصولی)** | Money *others owe you*. |
| **Udhaar — Payable (کل قابل ادائیگی)** | Money *you owe others*. |
| **Settlement** | Recording that an Udhaar (owed money) has been paid, fully or partly. |

> **Very important rule the app follows:** Revenue and Profit are measured from **Payments** — the moment money is *received* — not from a job simply being marked "delivered." A job can be delivered and still unpaid; that adds nothing to revenue until the customer actually pays. This keeps your numbers honest: profit can never look bigger than the money you truly collected.

> **Every rupee is captured.** There is no way for money to change hands without being recorded: the **advance** at booking is a Payment, the **delivery** collection is a Payment, and a **settled Udhaar** becomes a Payment on its repair. The old "deliver and skip tracking" shortcut — which used to let a balance vanish from your records — has been removed.

> **"Total Price" on the form** is the same thing this guide calls Repair Price — the label was renamed to "Total Price" (کل قیمت) in the app.

---

## 4. Logging in (first thing each day)

1. Open the RepairDex Pro app. A **splash screen** shows briefly while it checks if you're already signed in.
2. If you were signed in before, it takes you straight to the Dashboard. If not, the **Login screen** appears (shop logo on the left, form on the right).
3. Type your **Email** and **Password**.
4. Click **Sign In**. A spinner shows "Logging in…".
5. On success, your session is saved **securely on this computer**, and the Dashboard opens automatically.
6. If the email/password is wrong, a red message explains the problem; fix it and try again.

*Signing out:* go to **Settings** → click **Logout** (top-right). This ends the session and returns you to the Login screen.

> **Device is locked to one account.** Each installed copy is tied to the **first account that signs in** on it. If someone later enters a *different* (even valid) login on that computer, access is refused with a clear message — this prevents casual account sharing across shops. *(If you personally re-assign a device to a new client, your administrator resets this on the machine.)*

---

## 5. The Dashboard — your daily control room

The Dashboard is the landing screen. From top to bottom:

### 5.1 Reminder banners (only appear when relevant)
- **Overdue Deliveries** (red) — repair jobs whose promised delivery date has passed but haven't been delivered. You can, right from the banner: **Mark as Delivered**, or **Extend Delivery Date**, or dismiss.
- **Overdue Udhaar** (red) — owed money whose due date has passed. From here you can **Record Settlement** or **Extend Due Date**.
- **Missed Cloud Backup** — a nudge if your scheduled online backup didn't run.
- **Recurring expenses to confirm** — for any expense you've marked *"repeats every month"* that you haven't logged yet this month, a one-tap **Add** button opens a ready-made draft pre-filled with last month's amount; just confirm or adjust.

All reminders sit in one **compact, self-scrolling band** — no matter how many are active at once, they can never push the summary cards and lists off the screen.

### 5.2 Today's Deliveries
A list of jobs due for handover **today**. Each row shows the customer, device, and quick action buttons. Delivered/cancelled jobs drop off this list automatically.

### 5.3 The number cards (what each one means)

| Card | What it counts |
|---|---|
| **Today's Repairs** | Jobs *created* today. |
| **Pending Repairs** | All jobs currently in "pending" status (not yet worked on). |
| **Ready for Pickup** | All jobs in "completed" status — work done, waiting for the customer. |
| **Today's Revenue** | Money received today (sum of today's payments). |
| **Today's Profit** | Profit realized from today's payments. |
| **Monthly Revenue** | Money received so far this month. |
| **Monthly Profit** | Profit realized so far this month. |
| **Monthly Expenses** | Money spent this month. |
| **Net Profit** | Monthly Profit − Monthly Expenses (your real bottom line for the month). |
| **Total Receivables** | Everything others currently owe you (open Udhaar receivables). |
| **Total Payables** | Everything you currently owe others (open Udhaar payables). |

### 5.4 Recent Repairs & Recent Activity
Two lists at the bottom: the latest jobs (with quick status actions) and a feed of recent actions across the whole app.

### 5.5 The Dashboard updates live
Every number and list updates **in real time**. The moment a payment is recorded, a job's status changes, an Udhaar is settled, or an expense is added — **anywhere in the app** — the Dashboard cards and lists refresh themselves instantly. You never need to leave and come back, or manually refresh, to see current figures.

---

## 6. Repairs — the core flow

This is where most of your day happens. A repair job moves through a simple, one-way lifecycle:

```
  PENDING ──► COMPLETED ──► DELIVERED   (final, locked)
     │             │
     │             └──► (can be reverted back to Pending)
     └──────────────────► CANCELLED     (final, locked)
```

- **Pending** — booked, work not done yet (the starting status).
- **Completed** — work is finished, waiting for the customer ("Ready for Pickup").
- **Delivered** — handed back to the customer. **Final — cannot be changed after this.**
- **Cancelled** — job called off. **Final — cannot be changed after this.**

Once a job is **Delivered** or **Cancelled**, its status is **locked** and cannot be changed again.

### 6.1 Creating a new repair job — every step
1. Click **Repairs** in the sidebar, then the **Add New** button (or use **Add Repair** on the Dashboard).
2. **Choose the customer:**
   - Start typing a name/phone in the **customer picker** to find an existing customer, **or**
   - Create a brand-new customer on the spot if they're not in the list.
   - *(You must select a customer before saving — a reminder appears if you skip this.)*
3. Fill in the device details: **Brand** and **Model** (both required), and the **Issue** description (required).
4. Optionally add **Accessories** (e.g. "with charger") and **IMEI/serial**.
5. Optionally set **Estimated Delivery Date** and **Delivery Time**, and a **Priority** (Low / Normal / High).
6. Enter the money fields:
   - **Cost Price** — what it costs you.
   - **Repair Price** — what you charge.
   - **Advance** — any amount taken up front.
   - The **Remaining Balance** updates automatically as you type (Repair Price − Advance).
7. Optionally add **Notes**.
8. Click **Save**. The job is created and you land on its **detail page**. This action is written to the Activity log.

### 6.2 The repair detail page — what's on it
- Device, issue, and current **status badge**.
- **Edit** and **Delete** buttons (top-right).
- Customer card with a link to the full customer profile.
- A **Change Status** panel (hidden once the job is delivered/cancelled).
- Four money cards: **Cost Price, Repair Price, Advance, Remaining Balance**.
- Job details: priority, accessories, IMEI, delivery date/time, notes.
- **Payment History** with a **Record Payment** button.
- A **Print Receipt** button.

### 6.3 Moving a job through its stages
Wherever you see a job (detail page, Repairs list, or Dashboard rows), the same status buttons appear:
- On a **Pending** job: **Mark Completed** (primary button); "Cancel Order" is tucked in the "more" (⋯) menu.
- On a **Completed** job: **Mark as Delivered** (primary) and, if money is still owed, **Deliver on Credit** (secondary); "Revert to Pending" and "Cancel Order" are also available.
- On **Delivered/Cancelled** jobs: no status buttons (locked).

### 6.4 Recording an interim payment (before delivery)
Use this only when a customer pays *down* their balance **while the job is still in progress** (Pending or Completed) — for example, a top-up before the repair is finished.
1. On the repair's detail page, click **Record Payment** (in the Payment History card). *(This button is hidden once a job is Delivered — see §6.5 for how delivery money is handled.)*
2. Type the **Amount**, pick a **Payment Type** (Advance / Partial / Full — auto-suggested), set the **Payment Date**, optionally add a note.
3. If the amount is more than what's owed, the app confirms the **overpayment** first.
4. Click **Save** — the payment appears in Payment History, the balance drops, and it counts toward Revenue/Profit instantly.

### 6.5 Delivering a job — the two money paths
When a job is **Completed**, delivering it is a *money event*, and you choose how the customer is paying. There is no "skip and forget" option — money is always recorded one way or the other.

**A) "Mark as Delivered" — customer pays in full and takes the device.**
- One click records a **Payment for the whole remaining balance** *and* marks the job Delivered.
- The balance goes to zero, and the money shows in **Today's Revenue** immediately.
- *(If the job was already fully paid, it simply delivers — no empty payment is created.)*

**B) "Deliver on Credit" — customer pays part (or none) and owes the rest.**
- Opens a small window where you set **how much stays on credit (Udhaar)**:
  - **100%** — the whole balance goes on credit (input locks; nothing paid now).
  - **50%** — half on credit, half paid now.
  - **Any amount** — type the credit portion; the rest is auto-recorded as paid.
  - Optionally set a **Due Date** so it shows up in Overdue reminders.
- On confirm: the paid part is recorded as a **Payment**, a **Receivable Udhaar** (linked to this job) is created for the credit part, and the job is Delivered — all at once.
- Later, when the customer pays the Udhaar off, **Record Settlement** (§9.3) turns it into a Payment on this same job, so it counts as Revenue **then** — not before.

> **In short:** *Mark as Delivered* = paid now. *Deliver on Credit* = some/all owed, tracked as Udhaar. Either way, every rupee is captured.

### 6.6 Printing a receipt
1. On the detail page, click **Print Receipt**.
2. A receipt preview opens, using your shop's **branding** (logo, name, phone, address) and your custom **header/footer** text (set in Settings).
3. Print it or save as needed.

### 6.7 Editing or deleting a job
- **Edit** — change any details; balances recalculate safely and never erase payments already recorded.
- **Delete** — asks for confirmation, then removes the job from lists (a soft delete; it's archived, not shredded).

---

## 7. Customers

### 7.1 Viewing and searching
1. Click **Customers**. You see a table: **Name, Phone, Total Repairs, Last Visit**.
2. Type in the **search box** to filter by name or phone.
3. Click any row to open that customer's **profile**.

### 7.2 Adding a customer — every step
1. Click **Add New**.
2. Enter **Name** (required) and **Phone** (required).
3. If the phone number already exists, the app **warns you about the duplicate** and offers to open the existing profile — this stops the same customer being entered twice.
4. Optionally add **Address** and **Notes**.
5. Click **Save**. You land on the new customer's profile.

### 7.3 The customer profile
- Three summary cards: **Total Repairs**, **Total Spent** (the sum of every Payment they've made — which already includes their advances), and **Last Visit**.
- Address and notes (if any).
- **Repair History** — every job for this customer, with status and remaining balance; click any to open it.
- **Edit** and **Delete** buttons (delete asks for confirmation).

---

## 8. Payments (the money-in ledger)

This screen is a **read-only ledger** of every payment ever received, across all jobs.

1. Click **Payments**. You see a table: **Date, Customer, Device, Type, Amount, Notes**.
2. Filter by **search** (customer/device), **Payment Type**, and **Date Range** (Today / This Week / This Month / Custom).
3. A **Running Total** on the right sums whatever is currently shown — handy for "how much did I collect this week?"
4. Click any row to jump to that payment's repair job.

> New payments are always recorded from a **repair's detail page** (§6.4), because that's where the balance context lives. This page is purely for looking things up.

---

## 9. Udhaar (اُدھار) — money owed

Udhaar has two directions:
- **Receivable (کل وصولی)** — money people owe **you**.
- **Payable (کل قابل ادائیگی)** — money **you** owe others.

Udhaar entries come from two places:
1. **Automatically**, when you **Deliver on Credit** (§6.5) — this creates a *receivable linked to that repair* for the unpaid part.
2. **Manually**, for anything else — a personal loan, a supplier you owe, an advance to staff, etc.

### 9.1 The Udhaar screen
1. Click **Udhaar**. Toggle between **Receivables** and **Payables** at the top.
2. A summary card shows the total for the selected direction.
3. Filter by **status** (Pending / Partially Settled / Settled), by **overdue/upcoming**, or **search** by name/phone.
4. The table lists each entry: person, total amount, remaining balance, due date, and status.

### 9.2 Adding an Udhaar entry manually — every step
1. Click **Add New**.
2. Choose the **direction**: **Receivable** (they owe you) or **Payable** (you owe them).
3. Choose the person:
   - **Existing Customer** — pick from your customer list, **or**
   - **Someone Else** — type a name and (optional) phone (e.g. a supplier or friend).
4. Enter the **Amount**.
5. Optionally set a **Due Date** (leave blank for open-ended).
6. Optionally add **Notes**.
7. Click **Save**. You return to the Udhaar list.

### 9.3 Recording a settlement (someone pays / you pay) — every step
1. Find the entry (on the Udhaar screen or the Dashboard's Overdue banner) and click **Record Settlement**.
2. Enter the **Amount** being settled — or tap **Full** to fill the entire remaining balance in one click (the amount then locks so you can just confirm).
3. Set the **Settlement Date** (defaults to today).
4. Optionally add a **Note**.
5. If the amount is **more than what's owed**, the app confirms the overpayment first.
6. Click **Save**. The entry's remaining balance drops and its status updates (Pending → Partially Settled → Settled).

> **The important connection (recently improved):** When you settle a **receivable that is linked to a repair job**, the app now **also records a payment on that repair**. That means one action does three things at once:
> 1. the Udhaar balance goes down,
> 2. the **repair's** remaining balance clears,
> 3. and the money **counts as Revenue and Profit**.
>
> Standalone Udhaar (a personal loan, a supplier payable, etc.) stays separate and is **not** counted as shop revenue — which is correct, because it isn't repair income.

### 9.4 Extending a due date
On any unsettled entry, click **Extend Due Date**, pick a new date, and confirm. Useful when you give someone more time.

---

## 10. Expenses (money out)

### 10.1 Viewing
1. Click **Expenses**. The table shows **Category, Amount, Date, Description**.
2. Filter by **category** and **date range**. A **Running Total** sums what's shown.

### 10.2 Adding an expense — every step
1. Click **Add New**.
2. Pick a **Category** — shown **bilingually** (English — اردو): Rent, Electricity, Supplies, Salary, Maintenance, Personal Withdrawal, Other — **or** choose **Custom** and type your own category name.
3. Enter the **Amount**.
4. Optionally add a **Description**.
5. Set the **Expense Date** (defaults to today).
6. Optionally tick **"Repeats every month"** — use this for monthly bills like rent. There's no month to pick; it simply means this expense recurs. **Next month**, if you haven't logged it yet, the Dashboard shows a one-tap **Add** draft pre-filled with this amount (§5.1) — so you never re-type a fixed bill.
7. Click **Save**.

> Expenses reduce your **Net Profit**. They do **not** touch Revenue — Revenue is money in; Expenses are money out; Net Profit is the difference (after your repair margin is worked out).

---

## 11. Reports (profit/loss for any period)

1. Click **Reports**.
2. Choose a **period**: Daily, Weekly, Monthly, Yearly, or **Custom** (pick your own start/end dates).
3. The report builds automatically and shows:
   - Four headline cards: **Total Revenue, Total Repair Profit, Total Expenses, Net Profit**.
   - **Expenses by Category** (a ranked table).
   - **Top Brands** and **Top Models** repaired.
   - **Common Repair Types** (most frequent issues).
   - **Repairs by Status** (how many pending/completed/delivered/cancelled in the period).
4. To keep or share it:
   - **Export PDF** — saves a PDF file (named with the period and date) branded with your shop header.
   - **Print** — sends it straight to a printer.

> **Net Profit in a report** = Repair Profit (from money actually received in the period) − Expenses (in the period). It's the same honest logic as the Dashboard.

---

## 12. Analytics (trends over time)

1. Click **Analytics**. Toggle the time grain between **Day** and **Month** at the top.
2. You get visual charts:
   - **Revenue Trend** (line) — money in over time.
   - **Profit Trend** (line) — profit over time.
   - **Repair Volume** (bars) — jobs *created* vs *completed*.
   - **New Customers** (bars) — first-time customers over time.
   - **Repeat Customer Rate** — the % of customers who came back more than once.
   - **Top Customers** — your five biggest spenders.
   - **Brand Breakdown** — which device brands you repair most.

This section is for spotting patterns ("business is up this month," "Samsung is my biggest brand") — it's all read-only.

---

## 13. Activity log

1. Click **Activity**. You see a time-ordered feed of everything that happened: jobs created, statuses changed, payments recorded, udhaar settled, customers added/edited, logins/logouts, backups, and more.
2. Use it to answer "who did what, when" and to retrace steps. Nothing here is editable — it's a history record.

---

## 14. Settings

Settings has four parts plus **Logout** (top-right).

### 14.1 Branding
Set your shop's identity — used on receipts and report PDFs:
- **Shop Name**, **Currency** (e.g. PKR), **Phone**, **Address**, **Email**.
- **Logo** — upload an image; remove it anytime.
- **Brand Colour** — pick a colour; it applies instantly across the app.

### 14.2 Receipt settings
- **Header text** and **Footer text** — free text that appears on printed receipts (e.g. "Thank you", warranty terms, return policy).

### 14.3 Backups — local (on this computer)
Your data is precious; this keeps copies.
- **Default location** — where backups are saved (a built-in folder, or choose your own).
- **Frequency** — automatic **Daily** or **Weekly**.
- **Retention** — how many recent backups to keep (**7, 14, or 30**); older ones are cleaned up.
- **Backup Now** — make an immediate backup. **Choose Location** — make one in a folder you pick.
- **Restore from File** — load a previous backup (asks for confirmation, since it replaces current data).
- A list of **available backups** shows each one's type (Auto / Manual / Safety), date, and size, each with its own **Restore** button.

### 14.4 Backups — cloud (Google Drive, optional)
An extra, off-site copy in case the computer is lost/damaged. The cloud keeps **just the one latest backup** (each scheduled run replaces the previous — no growing history to manage).
1. **Connect** your Google Drive account. If that account **already has a backup** (e.g. you're setting up a replacement computer), the app tells you — *"Backup found from [date] — Restore this backup?"* — so you can pull all your data straight down. If you choose **Start fresh** instead, it warns you that the existing cloud backup will be replaced at the next scheduled backup.
2. Tick **Enable cloud backup**.
3. Set the **daily backup times** — three are set by default (**1 PM, 6 PM, 8 PM**); add, remove, or change them freely.
4. **Backup Now** uploads immediately; **Restore from Cloud** pulls the latest online backup back down (with confirmation).
5. The panel shows **when the last cloud backup ran**. If the Dashboard shows a "missed cloud backup" nudge, come here and run one.

---

## 14a. POS Mode — fast walk-in orders

For busy counters, **POS Mode** is a single, focused screen for creating an order start-to-finish without hopping between the Customers and Repairs pages.

1. Click **"Switch to POS Mode"** in the top bar. A clean full-screen order screen opens (no sidebar, no reports/history — just order entry). Use **"Switch to Dashboard"** to go back.
2. **Pick or create the customer** (same picker as everywhere else), then fill the device, issue, and prices. A live **Order Summary** on the right shows customer, device, total, advance, and remaining as you type.
3. Choose **how the order is leaving**:
   - **In for repair (Pending)** — the customer is leaving the device; it stays a pending job.
   - **Taking now — Paid in full** — records full payment and delivers.
   - **Taking now — On credit** — opens the same credit split (100/50/custom) and delivers on Udhaar.
4. Click **Save & Print Receipt** — it creates the order (applying your chosen path), then opens the receipt to print. The screen then **resets for the next customer**.

*Everything reuses the same logic as the rest of the app — same validation, same receipt, same money rules — so POS orders behave identically to ones made the normal way.*

---

## 15. How everything connects — worked examples

These examples show the ripple effect across modules. This is the part people find most useful.

### Example A — A normal paid job
1. **Customers/Repairs:** You book a Samsung screen repair for Ali. Total Price 5,000, Cost Price 2,000, Advance 0. Remaining = 5,000.
2. **Repairs:** You **Mark Completed**. When Ali comes to collect and pays, you click **Mark as Delivered**.
3. **What updates instantly (live, no refresh):** a Payment of 5,000 is recorded, Remaining Balance → 0, job → Delivered. **Today's Revenue** +5,000, **Today's Profit** +3,000 (5,000 charge − 2,000 parts). Payment shows in the **Payments** ledger.

### Example B — Booked with an advance
1. Total Price 5,000, **Advance 2,000** taken at booking. On save, that 2,000 is recorded as an **Advance payment** — so **Today's Revenue** shows +2,000 right away, and Remaining = 3,000.
2. When Ali collects and pays the rest, **Mark as Delivered** records the remaining 3,000 as a Payment → Revenue +3,000 more, balance 0.

### Example C — Delivered on credit, paid later (the linked Udhaar flow)
1. Total Price 4,000, no advance. Work done, but Ali takes the phone and will pay next week.
2. You click **Deliver on Credit** → choose **100%** on credit (or a split) → Confirm.
3. **What updates:** the job is Delivered; a **Receivable Udhaar of 4,000** (linked to Ali's job) appears; **Total Receivables** +4,000. Revenue does **not** move yet — no money received.
4. Next week Ali pays. Open the Udhaar entry → **Record Settlement** → tap **Full** → Save.
5. **In one step:** Udhaar → Settled, the **repair's** balance → 0, **Revenue** +4,000, and it appears in the **Payments** ledger. Everything reconciles. *(There is no way to deliver and leave this money untracked — the old "skip" shortcut is gone.)*

### Example D — A personal loan (standalone Udhaar)
1. You lend a neighbour 3,000. **Udhaar → Add New → Payable? No, Receivable → Someone Else → 3,000.**
2. **Result:** Total Receivables +3,000. When they repay, you **Record Settlement**. This is **not** counted as shop Revenue — correctly, because it's not repair income.

### Example E — Month-end picture
- **Monthly Revenue** = all payments received this month.
- **Monthly Profit** = your margin on those payments.
- **Monthly Expenses** = rent + electricity + salaries + parts + etc. logged this month.
- **Net Profit** = Monthly Profit − Monthly Expenses. If this is negative, expenses outweighed the profit you collected this month.

---

## 16. A suggested daily / weekly routine

**Every day:**
1. Open the app and log in.
2. Check the **Dashboard banners** — clear any Overdue Deliveries and Overdue Udhaar.
3. Book new jobs in **Repairs** (or use **POS Mode** for fast walk-ins — §14a); update statuses as work progresses.
4. At handover, use **Mark as Delivered** (paid in full) or **Deliver on Credit** (some/all owed) — either way the money is captured.
5. Log any **Expense** you paid that day.

**Every week / month:**
1. Review **Reports** for the period; export a PDF for your records.
2. Skim **Analytics** for trends.
3. Confirm recurring bills — the Dashboard offers a **one-tap draft** for anything marked "repeats every month."
4. Confirm your **backups** ran (local and, if enabled, cloud).

---

## 17. Backups & safety in one place

- Your live data sits in a single file on this computer.
- **Local backups** run automatically (daily/weekly) and keep your last 7–30 copies; you can also back up on demand and restore any copy.
- **Cloud backups** (Google Drive) give you an off-site copy on a schedule you set.
- **Restoring replaces your current data**, so the app always asks you to confirm first, and safety copies are made around risky operations.

> **Golden rule:** keep cloud backup enabled if you can. If the computer is ever lost or damaged, that off-site copy is what saves your business records.

---

## 18. Quick glossary (one line each)

- **Pending / Completed / Delivered / Cancelled** — the four stages of a repair job; the last two are final.
- **Advance** — money taken when booking; it **is** recorded as a Payment, so it counts as Revenue right away.
- **Total Price** — what you charge for the repair (labelled "Total Price / کل قیمت" on the form; earlier called Repair Price).
- **Remaining Balance** — what a customer still owes = Total Price − all Payments.
- **Payment** — money received, recorded in the app; this is what Revenue/Profit are built from. Advances, delivery collections, and settled Udhaar are all Payments.
- **Revenue** — total money received. **Profit** — your markup on money received. **Net Profit** — Profit minus Expenses.
- **Mark as Delivered** — deliver + record the full remaining balance as paid. **Deliver on Credit** — deliver + track the unpaid part as Udhaar.
- **Receivable** — money owed to you. **Payable** — money you owe. **Settlement** — recording that an Udhaar has been paid.
- **Linked Udhaar** — a receivable created by "Deliver on Credit"; settling it also pays off the job and counts as Revenue.
- **POS Mode** — a fast, one-screen order-creation flow for walk-ins.
- **Device lock** — each install is tied to its first sign-in account.
- **Backup / Restore** — a saved copy of all your data / loading a saved copy back. Cloud keeps one latest copy.

---

*End of guide. If any screen changes in a future update, this document should be refreshed to match.*
