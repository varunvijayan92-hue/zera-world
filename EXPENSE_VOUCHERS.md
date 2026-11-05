# Expense vouchers

Accounts → Add expense / payment voucher records courier payments, packing materials,
stationery and other purchases. Admins and managers can record vouchers; customer
and supplier access is rejected. Same-origin checks protect writes.

Each submission creates one INR Expense and its immutable CREATE_EXPENSE_VOUCHER
audit record in a database transaction. The audit includes payee, bill reference,
payment method/reference and voucher number. An explicit submission UUID prevents
repeated network submissions from inserting another expense (duplicate returns 409).
No new table or database migration is required.

The same Expense is included in Accounts exports/printing and Profit & Expenses.
The Accounts reference links to a printable individual voucher. Filter by date,
EXPENSE and payee/reference to export vouchers. Dates use India time.

Record the total actually paid, including tax. Do not repeat a courier charge already
saved as a shipment cost or any expense entered in Profit & Expenses. The required
confirmation is an operator check; it cannot reconcile external bills automatically.
This feature records expenses; it does not send payments or claim input tax credit.

## Official GST files: pending

Accounts → GST return files explains missing prerequisites. No generic ledger JSON
is presented as a GST portal upload. GSTIN, registration state and filing frequency
must be supplied. Numbered invoices and credit/debit notes with invoice-time HSN,
UQC, place of supply and tax splits are not yet implemented. Neither GSTR-1 nor
GSTR-3B upload JSON generation is complete. Marketplace and ITC reconciliation
also remain necessary where applicable. No return is submitted automatically.

Official references checked November 2026:
- https://tutorial.gst.gov.in/userguide/returns/Creation_of_Outward_Supplies_Return_in_GSTR-1.htm
- https://tutorial.gst.gov.in/downloads/invoiceuploadofflineutility.pdf

Validate final generated files with the current official offline tool and review
them before filing. The portal's download page returned HTTP 403 in this environment.
