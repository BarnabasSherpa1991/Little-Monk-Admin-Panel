import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  TrendingUp,
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import {
  buildWhatsAppLink,
  formatAxisINR,
  formatCurrency,
  formatDate,
  isOverdueDate,
  isTodayDate,
  todayISO,
} from '../../utils/formatters';

const CHART_COLORS = ['#0D9488', '#0F2744', '#2563EB', '#D97706', '#DC2626', '#64748B'];

export const DashboardView: React.FC = () => {
  const {
    enquiries,
    bookings,
    payments,
    followUps,
    setActiveModule,
    saveFollowUp,
    darkMode,
  } = useCRM();

  const today = todayISO();
  const currentMonth = today.slice(0, 7);

  const stats = useMemo(() => {
    const totalEnquiries = enquiries.length;
    const newEnquiries = enquiries.filter((e) => e.status === 'New Enquiry').length;
    const pendingFollowUps = followUps.filter((f) => f.status === 'Pending').length;
    const confirmedBookings = bookings.filter((b) => b.bookingStatus === 'Confirmed').length;
    const upcomingTours = bookings.filter(
      (b) => (b.bookingStatus === 'Confirmed' || b.bookingStatus === 'Pending') && b.startDate >= today
    ).length;
    const ongoingTours = bookings.filter((b) => b.bookingStatus === 'In Progress').length;
    const completedTours = bookings.filter((b) => b.bookingStatus === 'Completed').length;
    const cancelledBookings = bookings.filter((b) => b.bookingStatus === 'Cancelled').length;

    const activeBookings = bookings.filter((b) => b.bookingStatus !== 'Cancelled');
    const totalRevenue = activeBookings.reduce((sum, b) => sum + Number(b.bookingAmount || 0), 0);
    const outstandingPayments = activeBookings.reduce(
      (sum, b) => sum + Number(b.remainingAmount || 0),
      0
    );

    const monthlySales = activeBookings
      .filter((b) => (b.startDate || '').startsWith(currentMonth) || (b.createdAt?.toDate?.()?.toISOString?.() || '').startsWith(currentMonth))
      .reduce((sum, b) => sum + Number(b.bookingAmount || 0), 0);

    const convertedCount = enquiries.filter((e) => e.status === 'Booking Confirmed').length;
    const conversionRate =
      totalEnquiries > 0 ? Math.round((convertedCount / totalEnquiries) * 100) : 0;

    return {
      totalEnquiries,
      newEnquiries,
      pendingFollowUps,
      confirmedBookings,
      upcomingTours,
      ongoingTours,
      completedTours,
      cancelledBookings,
      totalRevenue,
      outstandingPayments,
      monthlySales,
      conversionRate,
    };
  }, [enquiries, bookings, followUps, today, currentMonth]);

  // Monthly Revenue & Monthly Enquiry Performance
  const monthlySeries = useMemo(() => {
    const map = new Map<string, { month: string; revenue: number; enquiries: number; converted: number }>();
    const ensureMonth = (ym: string) => {
      if (!map.has(ym)) {
        const [y, m] = ym.split('-');
        const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', {
          month: 'short',
          year: '2-digit',
        });
        map.set(ym, { month: label, revenue: 0, enquiries: 0, converted: 0 });
      }
      return map.get(ym)!;
    };

    payments.forEach((p) => {
      const ym = (p.paymentDate || today).slice(0, 7);
      const entry = ensureMonth(ym);
      entry.revenue += p.type === 'Refund' ? -Number(p.amount || 0) : Number(p.amount || 0);
    });

    bookings
      .filter((b) => b.bookingStatus !== 'Cancelled')
      .forEach((b) => {
        const ym = (b.startDate || today).slice(0, 7);
        const entry = ensureMonth(ym);
        if (entry.revenue === 0) {
          entry.revenue += Number(b.bookingAmount || 0);
        }
      });

    enquiries.forEach((e) => {
      const ym = (e.enquiryDate || today).slice(0, 7);
      const entry = ensureMonth(ym);
      entry.enquiries += 1;
      if (e.status === 'Booking Confirmed') entry.converted += 1;
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [payments, bookings, enquiries, today]);

  // Enquiry Conversion Funnel
  const enquiryFunnelData = useMemo(() => {
    const statuses = [
      'New Enquiry',
      'Contacted',
      'Follow-up Required',
      'Quotation Sent',
      'Negotiation',
      'Booking Confirmed',
      'Lost',
    ];
    return statuses.map((s) => ({
      stage: s.replace('Follow-up Required', 'Follow-up').replace('Booking Confirmed', 'Confirmed'),
      count: enquiries.filter((e) => e.status === s).length,
    }));
  }, [enquiries]);

  // Booking Status Breakdown
  const bookingStatusData = useMemo(() => {
    const statuses = ['Pending', 'Confirmed', 'In Progress', 'Completed', 'Cancelled'];
    return statuses
      .map((s) => ({
        name: s,
        value: bookings.filter((b) => b.bookingStatus === s).length,
      }))
      .filter((d) => d.value > 0);
  }, [bookings]);

  // Destination-wise Bookings
  const destinationData = useMemo(() => {
    const map = new Map<string, { destination: string; bookings: number; value: number }>();
    bookings
      .filter((b) => b.bookingStatus !== 'Cancelled')
      .forEach((b) => {
        const key = b.destination.split(',')[0].trim();
        const prev = map.get(key) || { destination: key, bookings: 0, value: 0 };
        prev.bookings += 1;
        prev.value += Number(b.bookingAmount || 0);
        map.set(key, prev);
      });
    return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [bookings]);

  // Today & Overdue Follow-ups
  const todaysFollowUps = useMemo(
    () =>
      followUps
        .filter((f) => f.status === 'Pending' && (isTodayDate(f.dueDate) || isOverdueDate(f.dueDate)))
        .slice(0, 6),
    [followUps]
  );

  // Upcoming Departures
  const upcomingDepartures = useMemo(
    () =>
      bookings
        .filter((b) => b.bookingStatus !== 'Cancelled' && b.bookingStatus !== 'Completed')
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .slice(0, 5),
    [bookings]
  );

  // Recent Customer Activities
  const recentActivities = useMemo(() => {
    const items: { id: string; title: string; meta: string; module: 'enquiries' | 'bookings' | 'payments' }[] = [];
    enquiries.slice(0, 3).forEach((e) =>
      items.push({
        id: 'e-' + e.id,
        title: `${e.customerName} — ${e.destination}`,
        meta: `${e.enquiryCode} · ${e.status} · ${e.source}`,
        module: 'enquiries',
      })
    );
    payments.slice(0, 3).forEach((p) =>
      items.push({
        id: 'p-' + p.id,
        title: `${p.type}: ${formatCurrency(p.amount)} (${p.customerName})`,
        meta: `${p.receiptCode} · ${p.mode} · ${formatDate(p.paymentDate)}`,
        module: 'payments',
      })
    );
    bookings.slice(0, 2).forEach((b) =>
      items.push({
        id: 'b-' + b.id,
        title: `Booking ${b.bookingCode}: ${b.customerName}`,
        meta: `${b.destination} · ${b.bookingStatus}`,
        module: 'bookings',
      })
    );
    return items.slice(0, 6);
  }, [enquiries, payments, bookings]);

  const axisColor = darkMode ? '#94A3B8' : '#64748B';
  const gridColor = darkMode ? '#1E293B' : '#E2E8F0';
  const tooltipStyle = {
    backgroundColor: darkMode ? '#0F172A' : '#FFFFFF',
    borderColor: darkMode ? '#1E293B' : '#E2E8F0',
    borderRadius: '8px',
    fontSize: '12px',
    color: darkMode ? '#F8FAFC' : '#0F172A',
  };

  return (
    <div className="space-y-6">
      {/* Primary Financial & Pipeline KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Revenue (INR)</div>
          <div className="mt-1.5 text-base sm:text-lg xl:text-xl font-bold font-mono tabular-nums break-words text-slate-900 dark:text-slate-100">
            {formatCurrency(stats.totalRevenue)}
          </div>
          <div className="mt-1 text-xs text-teal-600 dark:text-teal-400 tabular-nums">
            Month: {formatCurrency(stats.monthlySales)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Outstanding Payments</div>
          <div className="mt-1.5 text-base sm:text-lg xl:text-xl font-bold font-mono tabular-nums break-words text-amber-600 dark:text-amber-400">
            {formatCurrency(stats.outstandingPayments)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Receivable balance (INR)</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Enquiries</div>
          <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {stats.totalEnquiries}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {stats.newEnquiries} new · {stats.conversionRate}% conv.
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Confirmed Bookings</div>
          <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {stats.confirmedBookings}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {stats.upcomingTours} upcoming tours
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Tour Execution</div>
          <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {stats.ongoingTours} / {stats.completedTours}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Ongoing / Completed · {stats.cancelledBookings} cancelled
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Follow-ups Pending</div>
          <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {stats.pendingFollowUps}
          </div>
          <div className="mt-1 text-xs text-teal-600 dark:text-teal-400 tabular-nums">
            {todaysFollowUps.length} due today/overdue
          </div>
        </div>
      </div>

      {/* Charts Row 1: Monthly Revenue & Monthly Enquiry Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Monthly Revenue Performance
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Collections & booking revenue by month
              </p>
            </div>
            <TrendingUp className="w-4 h-4 text-teal-600" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlySeries}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0D9488" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: axisColor }} />
                <YAxis
                  tick={{ fontSize: 11, fill: axisColor }}
                  tickFormatter={formatAxisINR}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: any) => [formatCurrency(Number(v)), 'Revenue']}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0D9488"
                  strokeWidth={2}
                  fill="url(#revGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Monthly Enquiry Performance
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Total enquiries received vs confirmed conversions
              </p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: axisColor }} />
                <YAxis tick={{ fontSize: 11, fill: axisColor }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line
                  type="monotone"
                  dataKey="enquiries"
                  name="Enquiries"
                  stroke="#0F2744"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="converted"
                  name="Converted"
                  stroke="#0D9488"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2: Enquiry Conversion, Booking Status, Destination-wise Bookings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Enquiry Conversion Funnel
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Leads distributed across pipeline stages
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={enquiryFunnelData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="stage" tick={{ fontSize: 10, fill: axisColor }} interval={0} angle={-20} textAnchor="end" height={45} />
                <YAxis tick={{ fontSize: 11, fill: axisColor }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Enquiries" fill="#0D9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Booking Status Breakdown
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Distribution of active and past bookings
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={bookingStatusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={2}
                >
                  {bookingStatusData.map((_, idx) => (
                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Destination-wise Bookings
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Top destinations by booking revenue
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={destinationData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: axisColor }}
                  tickFormatter={formatAxisINR}
                />
                <YAxis type="category" dataKey="destination" width={85} tick={{ fontSize: 11, fill: axisColor }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: any) => [formatCurrency(Number(v)), 'Revenue']}
                />
                <Bar dataKey="value" fill="#0F2744" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Operational Lists: Today's Follow-ups, Upcoming Departures, Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Follow-up Reminders */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Today’s & Overdue Follow-ups
            </h3>
            <button
              type="button"
              onClick={() => setActiveModule('followups')}
              className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:underline"
            >
              Manage all
            </button>
          </div>
          {todaysFollowUps.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              All scheduled follow-ups are up to date.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {todaysFollowUps.map((f) => {
                const overdue = isOverdueDate(f.dueDate);
                return (
                  <div key={f.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                        {f.title}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                        <span className={overdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                          {overdue ? `Overdue (${formatDate(f.dueDate)})` : `Today ${f.reminderTime || ''}`}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{f.priority}</span>
                        {f.customerName && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{f.customerName}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {f.customerPhone && (
                        <a
                          href={buildWhatsAppLink(
                            f.customerPhone,
                            `Hello ${f.customerName || ''}, following up regarding ${f.title}.`
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-md text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40"
                          title="WhatsApp Follow-up"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => saveFollowUp({ status: 'Completed' }, f.id)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                        title="Mark Completed"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming Departures */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Upcoming & Active Departures
            </h3>
            <button
              type="button"
              onClick={() => setActiveModule('bookings')}
              className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:underline"
            >
              View bookings
            </button>
          </div>
          {upcomingDepartures.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No upcoming departures scheduled.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {upcomingDepartures.map((b) => (
                <div key={b.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                      {b.customerName} — {b.destination}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <CalendarClock className="w-3 h-3 shrink-0" />
                      <span className="tabular-nums">{formatDate(b.startDate)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{b.bookingStatus}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                      {b.bookingCode}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-amber-600 dark:text-amber-400">
                      Due: {formatCurrency(b.remainingAmount)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Customer Activities */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Recent Customer Activities
            </h3>
          </div>
          {recentActivities.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No recent activities logged.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentActivities.map((act) => (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => setActiveModule(act.module)}
                  className="w-full text-left py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-2 hover:opacity-80 transition-opacity"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                      {act.title}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {act.meta}
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
