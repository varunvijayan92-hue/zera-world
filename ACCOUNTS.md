# Admin Accounts report

Open `/admin/accounts` from Finance → Accounts. Admins and managers have access; customer and supplier accounts cannot read the report or export.

The register combines payment transactions (including pending/failed attempts), refund records, expenses, recorded supplier settlements, recorded shipment costs and issued gift cards. Payment dates use verification timestamps when available, otherwise creation timestamps. Expenses use expense dates, supplier settlements use paid dates, and refund records use creation dates. Date filters include the full selected dates in India time, with a maximum range of 366 days.

Search matches references, names, methods, descriptions and record IDs. Type/status/search filters apply to the transaction register and its totals. Pages contain 50 rows. CSV export and the printable view contain all filtered rows, not just the current page. Periods containing more than 10,000 source transactions require a shorter range; a partial report is not silently exported.

P&L figures are read from the same financeReport function used by Profit & Expenses, for the selected dates. Transaction type/status/search filters do not change that section. Supplier settlements are listed as recorded payments without subtracting them again from P&L, which already includes the saved product costs. Pending/failed payments do not count as receipts. Gift-card issuance, redemption and refund values are labelled as store credit and separated from cash transaction totals.

Gift-card issuance values come from issuance audits. Legacy cards without an original-value audit show “Not recorded”, rather than incorrectly treating their remaining balance as their original value. Refunds without a known payment method are listed but excluded from the cash-refund total. Monetary category totals use INR records only. Foreign-currency expenses/refunds remain visible in their own currency and are excluded from the INR P&L estimate; no exchange rate is invented.

The report is based on saved application records. It is not a live bank statement or a marketplace/gateway settlement import. Profit remains an estimate that depends on complete product costs, courier costs, expenses and fee records. Original P&L datasets retain their existing 10,000-record limit per source.

CSV cells are escaped for spreadsheet formulas, include currency and stable record IDs, and distinguish transaction rows from P&L summary rows. Printed reports repeat table headings and use landscape A4 formatting.
