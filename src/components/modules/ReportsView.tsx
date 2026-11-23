import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  RotateCcw,
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { exportReportPDF, exportToCSV, exportToExcel } from '../../utils/pdfAndExport';
import { Pagination } from '../common/DataTableToolbar';

type ReportType =
  | 'daily_enquiries'
  | 'monthly_enquiries'
  | 'booking_reports'
  | 'destination_sales'
  | 'employee_performance'
  | 'revenue_reports'
  | 'profit_loss'
  | 'outstanding_payments'
  | 'customer_sources'
  | 'cancellation_reports'
  | 'supplier_expenses';

const REPORT_TABS: { key: ReportType; label: string }[] = [
  { key: 'daily_enquiries', label: 'Daily Enquiries' },
  { key: 'monthly_enquiries', label: 'Monthly Enquiries' },
  { key: 'booking_reports', label: 'Booking Reports' },
  { key: 'destination_sales', label: 'Destination Sales' },
  { key: 'employee_performance', label: 'Employee Performance' },
  { key: 'revenue_reports', label: 'Revenue Reports' },
  { key: 'profit_loss', label: 'Profit & Loss' },
  { key: 'outstanding_payments', label: 'Outstanding Payments' },
  { key: 'customer_sources', label: 'Acquisition Sources' },
  { key: 'cancellation_reports', label: 'Cancellations' },
  { key: 'supplier_expenses', label: 'Supplier Expenses' },
];

export const ReportsView: React.FC = () => {
  const {
    enquiries,
    bookings,
    payments,
    expenses,
    employees,
    settings,
  } = useCRM();

  const [reportType, setReportType] = useState<ReportType>('daily_enquiries');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterText, setFilterText] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const inRange = (d?: string) => {
    if (!d) return !dateFrom && !dateTo;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  };

  const reportData = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const matchesText = (s: string) => (!q ? true : s.toLowerCase().includes(q));

    switch (reportType) {
      case 'daily_enquiries': {
        const list = enquiries.filter(
          (e) =>
            inRange(e.enquiryDate) &&
            matchesText(`${e.enquiryCode} ${e.customerName} ${e.destination} ${e.source}`)
        );
        const byDate = new Map<
          string,
          { date: string; total: number; converted: number; lost: number; budget: number }
        >();
        list.forEach((e) => {
          const d = e.enquiryDate || 'Unknown';
          const cur = byDate.get(d) || { date: d, total: 0, converted: 0, lost: 0, budget: 0 };
          cur.total += 1;
          if (e.status === 'Booking Confirmed') cur.converted += 1;
          if (e.status === 'Lost' || e.status === 'Cancelled') cur.lost += 1;
          cur.budget += Number(e.budget || 0);
          byDate.set(d, cur);
        });
        const sorted = Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
        return {
          title: 'Daily Enquiries Report',
          subtitle: `${list.length} enquiries across ${sorted.length} active days`,
          kpis: [
            { label: 'Total Enquiries', value: String(list.length) },
            {
              label: 'Confirmed',
              value: String(list.filter((e) => e.status === 'Booking Confirmed').length),
            },
            {
              label: 'Pipeline Budget',
              value: formatCurrency(list.reduce((s, e) => s + Number(e.budget || 0), 0)),
            },
          ],
          headers: ['Enquiry Date', 'Total Enquiries', 'Confirmed', 'Lost / Cancelled', 'Estimated Pipeline Budget'],
          rows: sorted.map((r) => [
            formatDate(r.date),
            r.total,
            r.converted,
            r.lost,
            formatCurrency(r.budget),
          ]),
          rawRows: sorted.map((r) => [r.date, r.total, r.converted, r.lost, r.budget]),
        };
      }

      case 'monthly_enquiries': {
        const list = enquiries.filter(
          (e) =>
            inRange(e.enquiryDate) &&
            matchesText(`${e.destination} ${e.source} ${e.customerName}`)
        );
        const byMonth = new Map<
          string,
          { month: string; total: number; converted: number; quoted: number; budget: number }
        >();
        list.forEach((e) => {
          const m = (e.enquiryDate || '').slice(0, 7) || 'Unknown';
          const cur = byMonth.get(m) || { month: m, total: 0, converted: 0, quoted: 0, budget: 0 };
          cur.total += 1;
          if (e.status === 'Booking Confirmed') cur.converted += 1;
          if (e.status === 'Quotation Sent' || e.status === 'Negotiation') cur.quoted += 1;
          cur.budget += Number(e.budget || 0);
          byMonth.set(m, cur);
        });
        const sorted = Array.from(byMonth.values()).sort((a, b) => b.month.localeCompare(a.month));
        return {
          title: 'Monthly Enquiry Performance',
          subtitle: `Monthly aggregation covering ${list.length} enquiries`,
          kpis: [
            { label: 'Months Tracked', value: String(sorted.length) },
            { label: 'Total Enquiries', value: String(list.length) },
            {
              label: 'Overall Conversion',
              value: `${
                list.length > 0
                  ? Math.round(
                      (list.filter((e) => e.status === 'Booking Confirmed').length / list.length) *
                        100
                    )
                  : 0
              }%`,
            },
          ],
          headers: ['Month (YYYY-MM)', 'Total Enquiries', 'Quoted / Negotiating', 'Confirmed', 'Conversion %', 'Pipeline Budget'],
          rows: sorted.map((r) => [
            r.month,
            r.total,
            r.quoted,
            r.converted,
            `${r.total > 0 ? Math.round((r.converted / r.total) * 100) : 0}%`,
            formatCurrency(r.budget),
          ]),
          rawRows: sorted.map((r) => [
            r.month,
            r.total,
            r.quoted,
            r.converted,
            r.total > 0 ? Math.round((r.converted / r.total) * 100) : 0,
            r.budget,
          ]),
        };
      }

      case 'booking_reports': {
        const list = bookings.filter(
          (b) =>
            inRange(b.startDate) &&
            matchesText(`${b.bookingCode} ${b.customerName} ${b.destination} ${b.bookingStatus}`)
        );
        const totalAmt = list.reduce((s, b) => s + Number(b.bookingAmount || 0), 0);
        const totalPaid = list.reduce((s, b) => s + Number(b.advanceReceived || 0), 0);
        return {
          title: 'Tour Booking Register',
          subtitle: `${list.length} bookings matching active filters`,
          kpis: [
            { label: 'Bookings', value: String(list.length) },
            { label: 'Total Booking Value', value: formatCurrency(totalAmt) },
            { label: 'Collected', value: formatCurrency(totalPaid) },
          ],
          headers: [
            'Booking ID',
            'Customer',
            'Destination',
            'Departure',
            'Booking Status',
            'Payment Status',
            'Total Value',
            'Balance Due',
          ],
          rows: list.map((b) => [
            b.bookingCode,
            b.customerName,
            b.destination,
            formatDate(b.startDate),
            b.bookingStatus,
            b.paymentStatus,
            formatCurrency(b.bookingAmount),
            formatCurrency(b.remainingAmount),
          ]),
          rawRows: list.map((b) => [
            b.bookingCode,
            b.customerName,
            b.destination,
            b.startDate,
            b.bookingStatus,
            b.paymentStatus,
            b.bookingAmount,
            b.remainingAmount,
          ]),
        };
      }

      case 'destination_sales': {
        const activeBookings = bookings.filter(
          (b) =>
            b.bookingStatus !== 'Cancelled' &&
            inRange(b.startDate) &&
            matchesText(b.destination)
        );
        const map = new Map<
          string,
          { dest: string; bookings: number; pax: number; revenue: number; collected: number }
        >();
        activeBookings.forEach((b) => {
          const dest = b.destination || 'Other';
          const cur = map.get(dest) || { dest, bookings: 0, pax: 0, revenue: 0, collected: 0 };
          cur.bookings += 1;
          cur.pax += Number(b.adults || 0) + Number(b.children || 0);
          cur.revenue += Number(b.bookingAmount || 0);
          cur.collected += Number(b.advanceReceived || 0);
          map.set(dest, cur);
        });
        const sorted = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
        return {
          title: 'Destination-wise Sales Report',
          subtitle: `${sorted.length} active destinations`,
          kpis: [
            { label: 'Destinations', value: String(sorted.length) },
            { label: 'Active Bookings', value: String(activeBookings.length) },
            {
              label: 'Total Sales',
              value: formatCurrency(sorted.reduce((s, r) => s + r.revenue, 0)),
            },
          ],
          headers: ['Destination', 'Bookings', 'Total Travellers', 'Total Sales', 'Collected', 'Pending'],
          rows: sorted.map((r) => [
            r.dest,
            r.bookings,
            r.pax,
            formatCurrency(r.revenue),
            formatCurrency(r.collected),
            formatCurrency(Math.max(0, r.revenue - r.collected)),
          ]),
          rawRows: sorted.map((r) => [
            r.dest,
            r.bookings,
            r.pax,
            r.revenue,
            r.collected,
            Math.max(0, r.revenue - r.collected),
          ]),
        };
      }

      case 'employee_performance': {
        const list = employees.filter((emp) =>
          matchesText(`${emp.name} ${emp.role} ${emp.department || ''}`)
        );
        const rowsData = list.map((emp) => {
          const enqs = enquiries.filter(
            (e) => e.assignedToUid === emp.uid && inRange(e.enquiryDate)
          );
          const bks = bookings.filter(
            (b) =>
              b.assignedToUid === emp.uid &&
              b.bookingStatus !== 'Cancelled' &&
              inRange(b.startDate)
          );
          const confirmed = enqs.filter((e) => e.status === 'Booking Confirmed').length;
          const rev = bks.reduce((s, b) => s + Number(b.bookingAmount || 0), 0);
          return {
            name: emp.name,
            role: emp.role,
            enquiries: enqs.length,
            confirmed,
            conv: enqs.length > 0 ? Math.round((confirmed / enqs.length) * 100) : 0,
            bookings: bks.length,
            rev,
          };
        });
        return {
          title: 'Employee Performance Report',
          subtitle: `${rowsData.length} staff members`,
          kpis: [
            { label: 'Team Members', value: String(rowsData.length) },
            {
              label: 'Total Sales Value',
              value: formatCurrency(rowsData.reduce((s, r) => s + r.rev, 0)),
            },
            {
              label: 'Confirmed Conversions',
              value: String(rowsData.reduce((s, r) => s + r.confirmed, 0)),
            },
          ],
          headers: [
            'Employee Name',
            'Role',
            'Assigned Enquiries',
            'Confirmed Leads',
            'Conversion %',
            'Active Bookings',
            'Sales Revenue',
          ],
          rows: rowsData.map((r) => [
            r.name,
            r.role,
            r.enquiries,
            r.confirmed,
            `${r.conv}%`,
            r.bookings,
            formatCurrency(r.rev),
          ]),
          rawRows: rowsData.map((r) => [
            r.name,
            r.role,
            r.enquiries,
            r.confirmed,
            r.conv,
            r.bookings,
            r.rev,
          ]),
        };
      }

      case 'revenue_reports': {
        const list = payments.filter(
          (p) =>
            inRange(p.paymentDate) &&
            matchesText(`${p.receiptCode} ${p.customerName} ${p.bookingCode || ''} ${p.mode}`)
        );
        const collected = list
          .filter((p) => p.type === 'Customer Collection')
          .reduce((s, p) => s + Number(p.amount || 0), 0);
        const refunded = list
          .filter((p) => p.type === 'Refund')
          .reduce((s, p) => s + Number(p.amount || 0), 0);
        const gstTotal = list
          .filter((p) => p.type === 'Customer Collection')
          .reduce((s, p) => s + Number(p.gstComponent || 0), 0);
        return {
          title: 'Revenue & Receipts Report',
          subtitle: `${list.length} payment transactions`,
          kpis: [
            { label: 'Gross Collections', value: formatCurrency(collected) },
            { label: 'Refunds Issued', value: formatCurrency(refunded) },
            { label: 'Net Receipts (GST Incl.)', value: `${formatCurrency(collected - refunded)} (${formatCurrency(gstTotal)} GST)` },
          ],
          headers: ['Receipt Code', 'Date', 'Type', 'Customer', 'Booking Ref', 'Mode', 'GST', 'Amount'],
          rows: list.map((p) => [
            p.receiptCode,
            formatDate(p.paymentDate),
            p.type,
            p.customerName,
            p.bookingCode || '—',
            p.mode,
            formatCurrency(p.gstComponent || 0),
            formatCurrency(p.amount),
          ]),
          rawRows: list.map((p) => [
            p.receiptCode,
            p.paymentDate,
            p.type,
            p.customerName,
            p.bookingCode || '',
            p.mode,
            p.gstComponent || 0,
            p.amount,
          ]),
        };
      }

      case 'profit_loss': {
        const filteredPayments = payments.filter((p) => inRange(p.paymentDate));
        const filteredExpenses = expenses.filter((e) => inRange(e.dueDate));
        const collections = filteredPayments
          .filter((p) => p.type === 'Customer Collection')
          .reduce((s, p) => s + Number(p.amount || 0), 0);
        const refunds = filteredPayments
          .filter((p) => p.type === 'Refund')
          .reduce((s, p) => s + Number(p.amount || 0), 0);
        const netRevenue = Math.max(0, collections - refunds);
        const totalSupplierCost = filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
        const totalExpensePaid = filteredExpenses.reduce((s, e) => s + Number(e.paidAmount || 0), 0);
        const netProfit = netRevenue - totalSupplierCost;
        const cashSurplus = netRevenue - totalExpensePaid;

        const breakdown = [
          { item: 'Gross Customer Collections', category: 'Income', amt: collections },
          { item: 'Less: Customer Refunds', category: 'Deduction', amt: -refunds },
          { item: 'Net Operating Revenue', category: 'Subtotal', amt: netRevenue },
          {
            item: 'Hotel Supplier Costs',
            category: 'Expense',
            amt: -filteredExpenses
              .filter((e) => e.category === 'Hotel Payment')
              .reduce((s, e) => s + Number(e.amount || 0), 0),
          },
          {
            item: 'Transport & Fleet Costs',
            category: 'Expense',
            amt: -filteredExpenses
              .filter((e) => e.category === 'Transport Payment')
              .reduce((s, e) => s + Number(e.amount || 0), 0),
          },
          {
            item: 'Sightseeing, Office & Other Costs',
            category: 'Expense',
            amt: -filteredExpenses
              .filter(
                (e) =>
                  e.category !== 'Hotel Payment' && e.category !== 'Transport Payment'
              )
              .reduce((s, e) => s + Number(e.amount || 0), 0),
          },
          { item: 'Net Accrual Profit / (Loss)', category: 'Bottom Line', amt: netProfit },
          { item: 'Net Cash Surplus (Receipts - Paid Out)', category: 'Cash Flow', amt: cashSurplus },
        ];

        return {
          title: 'Profit & Loss Statement',
          subtitle: 'Accrual revenue vs supplier & operational expenses',
          kpis: [
            { label: 'Net Revenue', value: formatCurrency(netRevenue) },
            { label: 'Total Expenses', value: formatCurrency(totalSupplierCost) },
            { label: 'Net Profit / (Loss)', value: formatCurrency(netProfit) },
          ],
          headers: ['Line Item', 'Classification', 'Amount'],
          rows: breakdown.map((b) => [b.item, b.category, formatCurrency(b.amt)]),
          rawRows: breakdown.map((b) => [b.item, b.category, b.amt]),
        };
      }

      case 'outstanding_payments': {
        const list = bookings.filter(
          (b) =>
            b.bookingStatus !== 'Cancelled' &&
            Number(b.remainingAmount || 0) > 0 &&
            inRange(b.startDate) &&
            matchesText(`${b.bookingCode} ${b.customerName} ${b.destination}`)
        );
        const totalDue = list.reduce((s, b) => s + Number(b.remainingAmount || 0), 0);
        return {
          title: 'Outstanding Customer Balances',
          subtitle: `${list.length} active bookings with pending receivable balances`,
          kpis: [
            { label: 'Bookings with Balance Due', value: String(list.length) },
            { label: 'Total Outstanding Receivable', value: formatCurrency(totalDue) },
            {
              label: 'Total Booking Value',
              value: formatCurrency(list.reduce((s, b) => s + Number(b.bookingAmount || 0), 0)),
            },
          ],
          headers: [
            'Booking ID',
            'Customer',
            'Phone',
            'Destination',
            'Departure',
            'Total Value',
            'Received',
            'Remaining Due',
          ],
          rows: list.map((b) => [
            b.bookingCode,
            b.customerName,
            b.customerPhone || '—',
            b.destination,
            formatDate(b.startDate),
            formatCurrency(b.bookingAmount),
            formatCurrency(b.advanceReceived),
            formatCurrency(b.remainingAmount),
          ]),
          rawRows: list.map((b) => [
            b.bookingCode,
            b.customerName,
            b.customerPhone || '',
            b.destination,
            b.startDate,
            b.bookingAmount,
            b.advanceReceived,
            b.remainingAmount,
          ]),
        };
      }

      case 'customer_sources': {
        const list = enquiries.filter(
          (e) => inRange(e.enquiryDate) && matchesText(`${e.source} ${e.destination}`)
        );
        const map = new Map<
          string,
          { source: string; total: number; confirmed: number; lost: number; budget: number }
        >();
        list.forEach((e) => {
          const src = e.source || 'Other';
          const cur = map.get(src) || { source: src, total: 0, confirmed: 0, lost: 0, budget: 0 };
          cur.total += 1;
          if (e.status === 'Booking Confirmed') cur.confirmed += 1;
          if (e.status === 'Lost' || e.status === 'Cancelled') cur.lost += 1;
          cur.budget += Number(e.budget || 0);
          map.set(src, cur);
        });
        const sorted = Array.from(map.values()).sort((a, b) => b.total - a.total);
        return {
          title: 'Customer Acquisition Source Analysis',
          subtitle: `Lead volume and conversion across ${sorted.length} acquisition channels`,
          kpis: [
            { label: 'Active Channels', value: String(sorted.length) },
            { label: 'Total Leads', value: String(list.length) },
            { label: 'Top Channel', value: sorted[0]?.source || '—' },
          ],
          headers: ['Lead Source', 'Total Enquiries', 'Confirmed', 'Lost/Cancelled', 'Conversion %', 'Pipeline Budget'],
          rows: sorted.map((r) => [
            r.source,
            r.total,
            r.confirmed,
            r.lost,
            `${r.total > 0 ? Math.round((r.confirmed / r.total) * 100) : 0}%`,
            formatCurrency(r.budget),
          ]),
          rawRows: sorted.map((r) => [
            r.source,
            r.total,
            r.confirmed,
            r.lost,
            r.total > 0 ? Math.round((r.confirmed / r.total) * 100) : 0,
            r.budget,
          ]),
        };
      }

      case 'cancellation_reports': {
        const cancelledBookings = bookings.filter(
          (b) =>
            b.bookingStatus === 'Cancelled' &&
            inRange(b.startDate) &&
            matchesText(`${b.bookingCode} ${b.customerName} ${b.destination}`)
        );
        const lostEnquiries = enquiries.filter(
          (e) =>
            (e.status === 'Cancelled' || e.status === 'Lost') &&
            inRange(e.enquiryDate) &&
            matchesText(`${e.enquiryCode} ${e.customerName} ${e.destination}`)
        );
        const rows = [
          ...cancelledBookings.map((b) => ({
            type: 'Booking Cancelled',
            code: b.bookingCode,
            customer: b.customerName,
            destination: b.destination,
            date: b.startDate,
            value: b.bookingAmount,
            notes: b.specialNotes || '—',
          })),
          ...lostEnquiries.map((e) => ({
            type: `Enquiry ${e.status}`,
            code: e.enquiryCode,
            customer: e.customerName,
            destination: e.destination,
            date: e.enquiryDate,
            value: e.budget,
            notes: e.specialRequirements || '—',
          })),
        ];
        return {
          title: 'Cancellation & Lost Pipeline Report',
          subtitle: `${cancelledBookings.length} cancelled bookings and ${lostEnquiries.length} lost/cancelled enquiries`,
          kpis: [
            { label: 'Cancelled Bookings', value: String(cancelledBookings.length) },
            { label: 'Lost/Cancelled Leads', value: String(lostEnquiries.length) },
            {
              label: 'Cancelled Booking Value',
              value: formatCurrency(
                cancelledBookings.reduce((s, b) => s + Number(b.bookingAmount || 0), 0)
              ),
            },
          ],
          headers: ['Record Type', 'Code', 'Customer', 'Destination', 'Date', 'Value / Budget', 'Notes'],
          rows: rows.map((r) => [
            r.type,
            r.code,
            r.customer,
            r.destination,
            formatDate(r.date),
            formatCurrency(r.value),
            r.notes,
          ]),
          rawRows: rows.map((r) => [
            r.type,
            r.code,
            r.customer,
            r.destination,
            r.date,
            r.value,
            r.notes,
          ]),
        };
      }

      case 'supplier_expenses': {
        const list = expenses.filter(
          (e) =>
            inRange(e.dueDate) &&
            matchesText(`${e.expenseCode} ${e.vendorName} ${e.category} ${e.bookingCode || ''}`)
        );
        const total = list.reduce((s, e) => s + Number(e.amount || 0), 0);
        const paid = list.reduce((s, e) => s + Number(e.paidAmount || 0), 0);
        const pending = list.reduce((s, e) => s + Number(e.pendingAmount || 0), 0);
        return {
          title: 'Supplier & Operational Expenses',
          subtitle: `${list.length} expense records`,
          kpis: [
            { label: 'Total Expense Billed', value: formatCurrency(total) },
            { label: 'Total Paid', value: formatCurrency(paid) },
            { label: 'Pending Payable', value: formatCurrency(pending) },
          ],
          headers: [
            'Expense Code',
            'Category',
            'Vendor',
            'Booking Ref',
            'Due Date',
            'Status',
            'Total',
            'Paid',
            'Pending',
          ],
          rows: list.map((e) => [
            e.expenseCode,
            e.category,
            e.vendorName,
            e.bookingCode || '—',
            formatDate(e.dueDate),
            e.status,
            formatCurrency(e.amount),
            formatCurrency(e.paidAmount),
            formatCurrency(e.pendingAmount),
          ]),
          rawRows: list.map((e) => [
            e.expenseCode,
            e.category,
            e.vendorName,
            e.bookingCode || '',
            e.dueDate || '',
            e.status,
            e.amount,
            e.paidAmount,
            e.pendingAmount,
          ]),
        };
      }
    }
  }, [reportType, enquiries, bookings, payments, expenses, employees, dateFrom, dateTo, filterText]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return reportData.rows.slice(start, start + pageSize);
  }, [reportData.rows, page]);

  const handleReportSwitch = (next: ReportType) => {
    setReportType(next);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Report Selector Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-teal-600" />
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Business Intelligence Reports
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                exportToCSV(
                  `AzureTravel_${reportType}`,
                  reportData.headers,
                  reportData.rawRows
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() =>
                exportToExcel(
                  `AzureTravel_${reportType}`,
                  reportData.title,
                  reportData.headers,
                  reportData.rawRows
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Export Excel
            </button>
            <button
              type="button"
              onClick={() =>
                exportReportPDF(
                  `AzureTravel_${reportType}`,
                  reportData.title,
                  reportData.subtitle,
                  reportData.headers,
                  reportData.rows,
                  settings
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#0F2744] hover:bg-[#153459] rounded-lg whitespace-nowrap cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              Export PDF
            </button>
          </div>
        </div>

        {/* 11 Report Type Buttons */}
        <div className="flex flex-wrap gap-1.5">
          {REPORT_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => handleReportSwitch(t.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                reportType === t.key
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            aria-label="From date"
            className="px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            aria-label="To date"
            className="px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
          />
          <input
            type="text"
            value={filterText}
            onChange={(e) => {
              setFilterText(e.target.value);
              setPage(1);
            }}
            placeholder="Filter by keyword, destination, code..."
            className="w-64 px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
          />
          {(dateFrom || dateTo || filterText) && (
            <button
              type="button"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setFilterText('');
                setPage(1);
              }}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Report Summary Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {reportData.kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"
          >
            <div className="text-xs text-slate-500 dark:text-slate-400">{kpi.label}</div>
            <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Report Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {reportData.title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{reportData.subtitle}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs font-medium text-slate-500 dark:text-slate-400">
                {reportData.headers.map((h) => (
                  <th key={h} className="px-4 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm tabular-nums">
              {pagedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={reportData.headers.length}
                    className="px-4 py-12 text-center text-slate-500 text-sm"
                  >
                    No records found for this report and filter selection.
                  </td>
                </tr>
              ) : (
                pagedRows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className={`px-4 py-3 text-xs ${
                          cIdx === 0
                            ? 'font-medium text-slate-900 dark:text-slate-100'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={page}
          totalItems={reportData.rows.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
};
