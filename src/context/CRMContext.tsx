import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_SUPER_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
  signInWithGoogle,
  signOutUser,
} from '../firebase';
import {
  Booking,
  CompanySettings,
  Customer,
  Employee,
  EmployeeInvite,
  Enquiry,
  EnquiryActivity,
  Expense,
  FollowUp,
  Hotel,
  ModuleKey,
  ModulePermission,
  NotificationItem,
  Payment,
  Quotation,
  TourPackage,
  Vehicle,
  WhatsAppTemplate,
} from '../types/crm';
import { canAccess, getDefaultPermissionsForRole } from '../utils/permissions';
import { generateCode, todayISO } from '../utils/formatters';
import { seedInitialCRMData } from '../services/seedData';
import { ToastContainer, ToastMessage } from '../components/common/ToastContainer';

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

interface CRMContextValue {
  firebaseUser: User | null;
  authLoading: boolean;
  currentEmployee: Employee | null;
  accessDeniedReason: string | null;
  activeModule: ModuleKey;
  setActiveModule: (mod: ModuleKey) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (v: boolean) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  can: (mod: ModuleKey, action?: keyof ModulePermission) => boolean;
  toast: (type: ToastMessage['type'], message: string) => void;

  // Collections
  enquiries: Enquiry[];
  customers: Customer[];
  packages: TourPackage[];
  quotations: Quotation[];
  bookings: Booking[];
  hotels: Hotel[];
  vehicles: Vehicle[];
  payments: Payment[];
  expenses: Expense[];
  followUps: FollowUp[];
  employees: Employee[];
  invites: EmployeeInvite[];
  notifications: NotificationItem[];
  whatsappTemplates: WhatsAppTemplate[];
  settings: CompanySettings | null;
  dataLoading: boolean;

  // Cross-module draft handoff
  draftQuoteEnquiry: Enquiry | null;
  setDraftQuoteEnquiry: (e: Enquiry | null) => void;

  // Mutations
  saveEnquiry: (data: Partial<Enquiry>, id?: string) => Promise<string>;
  deleteEnquiry: (id: string) => Promise<void>;
  addEnquiryActivity: (enquiryId: string, type: EnquiryActivity['type'], content: string) => Promise<void>;
  convertEnquiryToBooking: (enquiry: Enquiry, details: {
    packageId?: string;
    packageName?: string;
    hotelId?: string;
    hotelName?: string;
    vehicleId?: string;
    vehicleDetails?: string;
    bookingAmount: number;
    advanceReceived: number;
    operationsManagerUid?: string;
    operationsManagerName?: string;
    specialNotes?: string;
  }) => Promise<string>;

  saveCustomer: (data: Partial<Customer>, id?: string) => Promise<string>;
  deleteCustomer: (id: string) => Promise<void>;

  savePackage: (data: Partial<TourPackage>, id?: string) => Promise<string>;
  deletePackage: (id: string) => Promise<void>;

  saveQuotation: (data: Partial<Quotation>, id?: string) => Promise<string>;
  deleteQuotation: (id: string) => Promise<void>;

  saveBooking: (data: Partial<Booking>, id?: string) => Promise<string>;
  deleteBooking: (id: string) => Promise<void>;

  saveHotel: (data: Partial<Hotel>, id?: string) => Promise<string>;
  deleteHotel: (id: string) => Promise<void>;

  saveVehicle: (data: Partial<Vehicle>, id?: string) => Promise<string>;
  deleteVehicle: (id: string) => Promise<void>;

  recordPayment: (data: {
    type: 'Customer Collection' | 'Refund';
    booking: Booking;
    amount: number;
    gstComponent: number;
    mode: Payment['mode'];
    referenceNumber: string;
    paymentDate: string;
    notes: string;
  }) => Promise<string>;
  deletePayment: (id: string) => Promise<void>;

  saveExpense: (data: Partial<Expense>, id?: string) => Promise<string>;
  deleteExpense: (id: string) => Promise<void>;

  saveFollowUp: (data: Partial<FollowUp>, id?: string) => Promise<string>;
  deleteFollowUp: (id: string) => Promise<void>;

  saveEmployee: (data: Partial<Employee>, id: string) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  inviteEmployee: (data: Omit<EmployeeInvite, 'id' | 'invitedByUid' | 'createdAt'>) => Promise<void>;
  deleteInvite: (email: string) => Promise<void>;

  saveWhatsAppTemplate: (data: Partial<WhatsAppTemplate>, id?: string) => Promise<void>;
  deleteWhatsAppTemplate: (id: string) => Promise<void>;

  saveCompanySettings: (data: Partial<CompanySettings>) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  reseedDemoData: () => Promise<void>;
}

const CRMContext = createContext<CRMContextValue | null>(null);

export const useCRM = () => {
  const ctx = useContext(CRMContext);
  if (!ctx) throw new Error('useCRM must be used within CRMProvider');
  return ctx;
};

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [accessDeniedReason, setAccessDeniedReason] = useState<string | null>(null);

  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('azure_crm_theme') === 'dark';
    } catch {
      return false;
    }
  });

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [packages, setPackages] = useState<TourPackage[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [invites, setInvites] = useState<EmployeeInvite[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [whatsappTemplates, setWhatsappTemplates] = useState<WhatsAppTemplate[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const [draftQuoteEnquiry, setDraftQuoteEnquiry] = useState<Enquiry | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem('azure_crm_theme', darkMode ? 'dark' : 'light');
    } catch {
      // ignore storage errors
    }
  }, [darkMode]);

  const toggleDarkMode = useCallback(() => setDarkMode((prev) => !prev), []);

  const toast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Auth & Employee Bootstrapping
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAccessDeniedReason(null);
      if (!user) {
        setCurrentEmployee(null);
        setAuthLoading(false);
        return;
      }

      try {
        const emailLower = (user.email || '').toLowerCase();
        const empRef = doc(db, 'employees', user.uid);
        const empSnap = await getDoc(empRef);

        if (empSnap.exists()) {
          const empData = { id: empSnap.id, ...empSnap.data() } as Employee;
          if (empData.status !== 'Active') {
            setAccessDeniedReason('Your employee account is currently marked Inactive. Contact your Super Admin.');
            setCurrentEmployee(null);
          } else {
            setCurrentEmployee(empData);
          }
        } else if (emailLower === BOOTSTRAPPED_SUPER_ADMIN_EMAIL.toLowerCase()) {
          // Ensure Super Admin employee doc exists first so user can always sign in
          const settingsSnap = await getDoc(doc(db, 'settings', 'company'));
          if (!settingsSnap.exists()) {
            await seedInitialCRMData(
              user.uid,
              user.displayName || 'Barnabas Sherpa',
              user.email || BOOTSTRAPPED_SUPER_ADMIN_EMAIL
            );
          } else {
            await setDoc(empRef, {
              uid: user.uid,
              name: user.displayName || 'Barnabas Sherpa',
              email: user.email || BOOTSTRAPPED_SUPER_ADMIN_EMAIL,
              phone: '',
              role: 'Super Admin',
              department: 'Executive Management',
              status: 'Active',
              permissions: getDefaultPermissionsForRole('Super Admin'),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          const refreshed = await getDoc(empRef);
          if (!refreshed.exists()) {
            throw new Error('Super Admin profile document could not be created.');
          }
          setCurrentEmployee({ id: refreshed.id, ...refreshed.data() } as Employee);
        } else {
          // Check if invited
          const inviteRef = doc(db, 'employee_invites', emailLower);
          const inviteSnap = await getDoc(inviteRef);
          if (inviteSnap.exists()) {
            const inv = inviteSnap.data() as EmployeeInvite;
            await setDoc(empRef, {
              uid: user.uid,
              name: inv.name || user.displayName || emailLower,
              email: emailLower,
              phone: inv.phone || '',
              role: inv.role,
              department: inv.department || 'Sales',
              status: 'Active',
              permissions: inv.permissions || getDefaultPermissionsForRole(inv.role),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            await deleteDoc(inviteRef);
            const refreshed = await getDoc(empRef);
            setCurrentEmployee({ id: refreshed.id, ...refreshed.data() } as Employee);
          } else {
            setAccessDeniedReason(
              `The Google account ${user.email} has not been invited to Azure Travel CRM yet. Ask your Super Admin (${BOOTSTRAPPED_SUPER_ADMIN_EMAIL}) to send an employee invitation from Team & RBAC.`
            );
            setCurrentEmployee(null);
          }
        }
      } catch (err: any) {
        console.error('Auth bootstrap error:', err);
        setAccessDeniedReason(
          `Unable to verify your CRM profile (${err?.code || err?.message || 'database error'}). Please try again or contact support.`
        );
        setCurrentEmployee(null);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsub();
  }, []);

  // Firestore real-time subscriptions gated on authenticated & active employee
  useEffect(() => {
    if (!firebaseUser || !currentEmployee || currentEmployee.status !== 'Active') {
      setEnquiries([]);
      setCustomers([]);
      setPackages([]);
      setQuotations([]);
      setBookings([]);
      setHotels([]);
      setVehicles([]);
      setPayments([]);
      setExpenses([]);
      setFollowUps([]);
      setEmployees([]);
      setInvites([]);
      setNotifications([]);
      setWhatsappTemplates([]);
      setSettings(null);
      return;
    }

    setDataLoading(true);
    const uid = firebaseUser.uid;
    const isManagerOrAdmin =
      firebaseUser.email?.toLowerCase() === BOOTSTRAPPED_SUPER_ADMIN_EMAIL.toLowerCase() ||
      ['Super Admin', 'Admin', 'Sales Manager', 'Operations Manager', 'Accounts Manager'].includes(
        currentEmployee.role
      );

    const unsubs: (() => void)[] = [];

    const subscribe = <T,>(
      path: string,
      qRef: any,
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      sortFn?: (a: any, b: any) => number
    ) => {
      const u = onSnapshot(
        qRef,
        (snap: any) => {
          const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) as T[];
          if (sortFn) list.sort(sortFn);
          setter(list);
          setDataLoading(false);
        },
        (err: any) => {
          handleFirestoreError(err, OperationType.LIST, path);
        }
      );
      unsubs.push(u);
    };

    const byCreatedDesc = (a: any, b: any) => {
      const ta = a.createdAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || 0;
      return tb - ta;
    };

    // Enquiries
    if (canAccess(currentEmployee, 'enquiries', 'view')) {
      const qEnq = isManagerOrAdmin
        ? collection(db, 'enquiries')
        : query(collection(db, 'enquiries'), where('assignedToUid', '==', uid));
      subscribe<Enquiry>('enquiries', qEnq, setEnquiries, byCreatedDesc);
    }

    // Customers
    if (canAccess(currentEmployee, 'customers', 'view')) {
      const qCust = isManagerOrAdmin
        ? collection(db, 'customers')
        : query(collection(db, 'customers'), where('assignedToUid', '==', uid));
      subscribe<Customer>('customers', qCust, setCustomers, byCreatedDesc);
    }

    // Tour Packages
    if (canAccess(currentEmployee, 'packages', 'view')) {
      const qPkg = isManagerOrAdmin
        ? collection(db, 'packages')
        : query(collection(db, 'packages'), where('isActive', '==', true));
      subscribe<TourPackage>('packages', qPkg, setPackages, byCreatedDesc);
    }

    // Quotations
    if (canAccess(currentEmployee, 'quotations', 'view')) {
      const qQt = isManagerOrAdmin
        ? collection(db, 'quotations')
        : query(collection(db, 'quotations'), where('assignedToUid', '==', uid));
      subscribe<Quotation>('quotations', qQt, setQuotations, byCreatedDesc);
    }

    // Bookings
    if (canAccess(currentEmployee, 'bookings', 'view')) {
      const qBk = isManagerOrAdmin
        ? collection(db, 'bookings')
        : query(collection(db, 'bookings'), where('assignedToUid', '==', uid));
      subscribe<Booking>('bookings', qBk, setBookings, byCreatedDesc);
    }

    // Hotels
    if (canAccess(currentEmployee, 'hotels', 'view')) {
      const qHotels = isManagerOrAdmin
        ? collection(db, 'hotels')
        : query(
            collection(db, 'hotels'),
            where('category', 'in', ['Standard', 'Deluxe', 'Premium', 'Luxury'])
          );
      subscribe<Hotel>('hotels', qHotels, setHotels, (a, b) =>
        (a.name || '').localeCompare(b.name || '')
      );
    }

    // Vehicles
    if (canAccess(currentEmployee, 'vehicles', 'view')) {
      const qVehicles = isManagerOrAdmin
        ? collection(db, 'vehicles')
        : query(
            collection(db, 'vehicles'),
            where('availability', 'in', ['Available', 'On Trip', 'Reserved', 'Maintenance'])
          );
      subscribe<Vehicle>('vehicles', qVehicles, setVehicles, byCreatedDesc);
    }

    // Payments & Expenses
    if (canAccess(currentEmployee, 'payments', 'view')) {
      const qPay = isManagerOrAdmin
        ? collection(db, 'payments')
        : query(collection(db, 'payments'), where('recordedByUid', '==', uid));
      subscribe<Payment>('payments', qPay, setPayments, byCreatedDesc);

      const qExp = isManagerOrAdmin
        ? collection(db, 'expenses')
        : query(collection(db, 'expenses'), where('recordedByUid', '==', uid));
      subscribe<Expense>('expenses', qExp, setExpenses, byCreatedDesc);
    }

    // Follow-ups
    if (canAccess(currentEmployee, 'followups', 'view')) {
      const qFu = isManagerOrAdmin
        ? collection(db, 'followups')
        : query(collection(db, 'followups'), where('assignedToUid', '==', uid));
      subscribe<FollowUp>('followups', qFu, setFollowUps, (a, b) =>
        (a.dueDate || '').localeCompare(b.dueDate || '')
      );
    }

    // Employees & Invites
    const qEmp = isManagerOrAdmin
      ? collection(db, 'employees')
      : query(collection(db, 'employees'), where('uid', '==', uid));
    subscribe<Employee>('employees', qEmp, setEmployees, (a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );

    if (['Super Admin', 'Admin'].includes(currentEmployee.role)) {
      subscribe<EmployeeInvite>('employee_invites', collection(db, 'employee_invites'), setInvites);
    }

    // Notifications
    const qNotif = isManagerOrAdmin
      ? collection(db, 'notifications')
      : query(collection(db, 'notifications'), where('targetUid', 'in', [uid, 'all']));
    subscribe<NotificationItem>('notifications', qNotif, setNotifications, byCreatedDesc);

    // WhatsApp Templates
    const qTpl = isManagerOrAdmin
      ? collection(db, 'whatsapp_templates')
      : query(
          collection(db, 'whatsapp_templates'),
          where('category', 'in', [
            'Enquiry Response',
            'Follow-up',
            'Quotation Sharing',
            'Booking Confirmation',
            'Payment Reminder',
            'Tour Reminder',
          ])
        );
    subscribe<WhatsAppTemplate>('whatsapp_templates', qTpl, setWhatsappTemplates);

    // Company Settings
    const uSettings = onSnapshot(
      doc(db, 'settings', 'company'),
      (snap) => {
        if (snap.exists()) setSettings(snap.data() as CompanySettings);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'settings/company')
    );
    unsubs.push(uSettings);

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [firebaseUser, currentEmployee]);

  const login = useCallback(async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      toast('error', err?.message || 'Google sign-in failed.');
    }
  }, [toast]);

  const logout = useCallback(async () => {
    await signOutUser();
    setActiveModule('dashboard');
  }, []);

  const can = useCallback(
    (mod: ModuleKey, action: keyof ModulePermission = 'view') => canAccess(currentEmployee, mod, action),
    [currentEmployee]
  );

  const createNotificationInternal = useCallback(
    async (
      title: string,
      message: string,
      category: NotificationItem['category'],
      linkModule: ModuleKey,
      targetUid = 'all'
    ) => {
      if (!firebaseUser) return;
      try {
        await addDoc(collection(db, 'notifications'), {
          title: title.slice(0, 150),
          message: message.slice(0, 500),
          category,
          targetUid,
          isRead: false,
          linkModule,
          createdByUid: firebaseUser.uid,
          createdAt: serverTimestamp(),
        });
      } catch {
        // Non-blocking notification failure
      }
    },
    [firebaseUser]
  );

  // ==================== CRUD Operations ====================

  const saveEnquiry = useCallback(
    async (data: Partial<Enquiry>, id?: string) => {
      if (!firebaseUser) throw new Error('Not authenticated');
      try {
        if (id) {
          const payload = stripUndefined({
            ...data,
            updatedAt: serverTimestamp(),
          });
          delete payload.id;
          delete payload.createdAt;
          delete payload.createdByUid;
          await updateDoc(doc(db, 'enquiries', id), payload);
          toast('success', 'Enquiry updated successfully.');
          return id;
        } else {
          const enquiryCode = data.enquiryCode || generateCode('ENQ', enquiries.length);
          const payload = stripUndefined({
            enquiryCode,
            customerId: data.customerId || '',
            customerName: (data.customerName || '').trim(),
            mobile: (data.mobile || '').trim(),
            whatsapp: data.whatsapp || data.mobile || '',
            email: data.email || '',
            source: data.source || 'Website',
            destination: (data.destination || '').trim(),
            startDate: data.startDate || '',
            endDate: data.endDate || '',
            adults: Number(data.adults ?? 2),
            children: Number(data.children ?? 0),
            infants: Number(data.infants ?? 0),
            rooms: Number(data.rooms ?? 1),
            hotelCategory: data.hotelCategory || 'Deluxe',
            budget: Number(data.budget ?? 0),
            preferredVehicle: data.preferredVehicle || 'Sedan',
            specialRequirements: data.specialRequirements || '',
            assignedToUid: data.assignedToUid || firebaseUser.uid,
            assignedToName: data.assignedToName || currentEmployee?.name || 'Executive',
            enquiryDate: data.enquiryDate || todayISO(),
            followUpDate: data.followUpDate || todayISO(),
            status: data.status || 'New Enquiry',
            createdByUid: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          const ref = await addDoc(collection(db, 'enquiries'), payload);
          await createNotificationInternal(
            `New Enquiry: ${payload.customerName}`,
            `${payload.enquiryCode} for ${payload.destination} (${payload.source}).`,
            'Enquiry',
            'enquiries',
            payload.assignedToUid
          );
          toast('success', `Enquiry ${enquiryCode} created.`);
          return ref.id;
        }
      } catch (err) {
        handleFirestoreError(err, id ? OperationType.UPDATE : OperationType.CREATE, 'enquiries');
      }
    },
    [firebaseUser, currentEmployee, enquiries.length, toast, createNotificationInternal]
  );

  const deleteEnquiry = useCallback(
    async (id: string) => {
      try {
        await deleteDoc(doc(db, 'enquiries', id));
        toast('success', 'Enquiry deleted.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `enquiries/${id}`);
      }
    },
    [toast]
  );

  const addEnquiryActivity = useCallback(
    async (enquiryId: string, type: EnquiryActivity['type'], content: string) => {
      if (!firebaseUser) throw new Error('Not authenticated');
      try {
        await addDoc(collection(db, 'enquiries', enquiryId, 'activities'), {
          type,
          content: content.trim().slice(0, 2000),
          authorUid: firebaseUser.uid,
          authorName: currentEmployee?.name || firebaseUser.email || 'Staff',
          createdAt: serverTimestamp(),
        });
        toast('success', 'Activity logged.');
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `enquiries/${enquiryId}/activities`);
      }
    },
    [firebaseUser, currentEmployee, toast]
  );

  const saveCustomer = useCallback(
    async (data: Partial<Customer>, id?: string) => {
      if (!firebaseUser) throw new Error('Not authenticated');
      try {
        if (id) {
          const payload = stripUndefined({ ...data, updatedAt: serverTimestamp() });
          delete payload.id;
          delete payload.createdAt;
          delete payload.createdByUid;
          await updateDoc(doc(db, 'customers', id), payload);
          toast('success', 'Customer profile updated.');
          return id;
        } else {
          const customerCode = data.customerCode || generateCode('CUS', customers.length);
          const payload = stripUndefined({
            customerCode,
            name: (data.name || '').trim(),
            mobile: (data.mobile || '').trim(),
            whatsapp: data.whatsapp || data.mobile || '',
            email: data.email || '',
            address: data.address || '',
            city: data.city || '',
            preferences: data.preferences || '',
            specialRequests: data.specialRequests || '',
            internalRemarks: data.internalRemarks || '',
            documents: data.documents || [],
            totalBookings: Number(data.totalBookings ?? 0),
            totalSpent: Number(data.totalSpent ?? 0),
            outstandingBalance: Number(data.outstandingBalance ?? 0),
            assignedToUid: data.assignedToUid || firebaseUser.uid,
            createdByUid: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          const ref = await addDoc(collection(db, 'customers'), payload);
          toast('success', `Customer ${customerCode} created.`);
          return ref.id;
        }
      } catch (err) {
        handleFirestoreError(err, id ? OperationType.UPDATE : OperationType.CREATE, 'customers');
      }
    },
    [firebaseUser, customers.length, toast]
  );

  const deleteCustomer = useCallback(
    async (id: string) => {
      try {
        await deleteDoc(doc(db, 'customers', id));
        toast('success', 'Customer record deleted.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `customers/${id}`);
      }
    },
    [toast]
  );

  const convertEnquiryToBooking = useCallback(
    async (
      enquiry: Enquiry,
      details: {
        packageId?: string;
        packageName?: string;
        hotelId?: string;
        hotelName?: string;
        vehicleId?: string;
        vehicleDetails?: string;
        bookingAmount: number;
        advanceReceived: number;
        operationsManagerUid?: string;
        operationsManagerName?: string;
        specialNotes?: string;
      }
    ) => {
      if (!firebaseUser) throw new Error('Not authenticated');
      try {
        let customerId = enquiry.customerId || '';
        const remaining = Math.max(0, details.bookingAmount - details.advanceReceived);
        const payStatus: Booking['paymentStatus'] =
          details.advanceReceived <= 0
            ? 'Unpaid'
            : remaining === 0
            ? 'Paid'
            : 'Partial';

        // Ensure Customer record exists
        if (!customerId) {
          const existingCust = customers.find(
            (c) => c.mobile === enquiry.mobile || (enquiry.email && c.email === enquiry.email)
          );
          if (existingCust) {
            customerId = existingCust.id;
          } else {
            const custRef = doc(collection(db, 'customers'));
            customerId = custRef.id;
            await setDoc(custRef, {
              customerCode: generateCode('CUS', customers.length),
              name: enquiry.customerName,
              mobile: enquiry.mobile,
              whatsapp: enquiry.whatsapp || enquiry.mobile,
              email: enquiry.email || '',
              address: '',
              city: '',
              preferences: '',
              specialRequests: enquiry.specialRequirements || '',
              internalRemarks: `Converted from ${enquiry.enquiryCode}`,
              documents: [],
              totalBookings: 1,
              totalSpent: details.advanceReceived,
              outstandingBalance: remaining,
              assignedToUid: enquiry.assignedToUid || firebaseUser.uid,
              createdByUid: firebaseUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }

        const bookingPrefix = settings?.bookingPrefix || 'BK';
        const bookingCode = generateCode(bookingPrefix, bookings.length);
        const bkRef = doc(collection(db, 'bookings'));

        const batch = writeBatch(db);
        batch.set(bkRef, {
          bookingCode,
          enquiryId: enquiry.id,
          quotationId: '',
          customerId,
          customerName: enquiry.customerName,
          customerPhone: enquiry.mobile,
          customerEmail: enquiry.email || '',
          destination: enquiry.destination,
          startDate: enquiry.startDate || todayISO(),
          endDate: enquiry.endDate || todayISO(),
          adults: enquiry.adults || 2,
          children: enquiry.children || 0,
          infants: enquiry.infants || 0,
          packageId: details.packageId || '',
          packageName: details.packageName || 'Custom Tour Package',
          hotelId: details.hotelId || '',
          hotelName: details.hotelName || '',
          vehicleId: details.vehicleId || '',
          vehicleDetails: details.vehicleDetails || enquiry.preferredVehicle || '',
          bookingAmount: details.bookingAmount,
          advanceReceived: details.advanceReceived,
          remainingAmount: remaining,
          paymentStatus: payStatus,
          bookingStatus: 'Confirmed',
          operationsManagerUid: details.operationsManagerUid || firebaseUser.uid,
          operationsManagerName: details.operationsManagerName || currentEmployee?.name || 'Operations Desk',
          assignedToUid: enquiry.assignedToUid || firebaseUser.uid,
          specialNotes: details.specialNotes || enquiry.specialRequirements || '',
          createdByUid: firebaseUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        batch.update(doc(db, 'enquiries', enquiry.id), {
          status: 'Booking Confirmed',
          customerId,
          updatedAt: serverTimestamp(),
        });

        await batch.commit();

        if (details.advanceReceived > 0) {
          const payRef = doc(collection(db, 'payments'));
          await setDoc(payRef, {
            receiptCode: generateCode('RCP', payments.length),
            type: 'Customer Collection',
            bookingId: bkRef.id,
            bookingCode,
            customerId,
            customerName: enquiry.customerName,
            amount: details.advanceReceived,
            gstComponent: Math.round((details.advanceReceived * (settings?.defaultGstPercent || 5)) / 105),
            mode: 'Bank Transfer',
            referenceNumber: 'ADV-' + bookingCode,
            paymentDate: todayISO(),
            notes: `Initial advance on conversion from ${enquiry.enquiryCode}`,
            recordedByUid: firebaseUser.uid,
            createdAt: serverTimestamp(),
          });
        }
        await createNotificationInternal(
          `Booking Confirmed: ${bookingCode}`,
          `${enquiry.customerName} confirmed ${enquiry.destination} (${bookingCode}).`,
          'Booking',
          'bookings'
        );
        toast('success', `Converted ${enquiry.enquiryCode} to Booking ${bookingCode}!`);
        return bkRef.id;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'bookings');
      }
    },
    [
      firebaseUser,
      currentEmployee,
      customers,
      bookings.length,
      payments.length,
      settings,
      toast,
      createNotificationInternal,
    ]
  );

  const savePackage = useCallback(
    async (data: Partial<TourPackage>, id?: string) => {
      if (!firebaseUser) throw new Error('Not authenticated');
      try {
        if (id) {
          const payload = stripUndefined({ ...data, updatedAt: serverTimestamp() });
          delete payload.id;
          delete payload.createdAt;
          delete payload.createdByUid;
          await updateDoc(doc(db, 'packages', id), payload);
          toast('success', 'Tour package updated.');
          return id;
        } else {
          const packageCode = data.packageCode || generateCode('PKG', packages.length).replace(/-\d{4}-/, '-');
          const payload = stripUndefined({
            packageCode,
            name: (data.name || '').trim(),
            destination: (data.destination || '').trim(),
            days: Number(data.days ?? 5),
            nights: Number(data.nights ?? 4),
            description: data.description || '',
            highlights: data.highlights || [],
            itinerary: data.itinerary || [],
            hotelDetails: data.hotelDetails || '',
            vehicleDetails: data.vehicleDetails || '',
            inclusions: data.inclusions || '',
            exclusions: data.exclusions || '',
            price: Number(data.price ?? 0),
            childPrice: Number(data.childPrice ?? 0),
            seasonalPrice: Number(data.seasonalPrice ?? 0),
            imageUrl: data.imageUrl || '/src/assets/images/package_swiss_alps_1795419417673.jpg',
            termsAndConditions: data.termsAndConditions || settings?.quotationTerms || '',
            isActive: data.isActive ?? true,
            createdByUid: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          const ref = await addDoc(collection(db, 'packages'), payload);
          toast('success', `Package ${packageCode} created.`);
          return ref.id;
        }
      } catch (err) {
        handleFirestoreError(err, id ? OperationType.UPDATE : OperationType.CREATE, 'packages');
      }
    },
    [firebaseUser, packages.length, settings, toast]
  );

  const deletePackage = useCallback(
    async (id: string) => {
      try {
        await deleteDoc(doc(db, 'packages', id));
        toast('success', 'Package deleted.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `packages/${id}`);
      }
    },
    [toast]
  );

  const saveQuotation = useCallback(
    async (data: Partial<Quotation>, id?: string) => {
      if (!firebaseUser) throw new Error('Not authenticated');
      try {
        if (id) {
          const payload = stripUndefined({ ...data, updatedAt: serverTimestamp() });
          delete payload.id;
          delete payload.createdAt;
          delete payload.createdByUid;
          await updateDoc(doc(db, 'quotations', id), payload);
          toast('success', 'Quotation updated.');
          return id;
        } else {
          const prefix = settings?.quotePrefix || 'QT';
          const quoteCode = data.quoteCode || generateCode(prefix, quotations.length);
          const payload = stripUndefined({
            quoteCode,
            version: Number(data.version ?? 1),
            enquiryId: data.enquiryId || '',
            customerId: data.customerId || '',
            customerName: (data.customerName || '').trim(),
            customerEmail: data.customerEmail || '',
            customerPhone: data.customerPhone || '',
            destination: (data.destination || '').trim(),
            startDate: data.startDate || '',
            endDate: data.endDate || '',
            paxSummary: data.paxSummary || '2 Adults',
            hotelItems: data.hotelItems || [],
            transportItems: data.transportItems || [],
            sightseeingCharge: Number(data.sightseeingCharge ?? 0),
            mealsCharge: Number(data.mealsCharge ?? 0),
            otherExpenses: Number(data.otherExpenses ?? 0),
            subtotal: Number(data.subtotal ?? 0),
            markupPercent: Number(data.markupPercent ?? 0),
            markupAmount: Number(data.markupAmount ?? 0),
            discountAmount: Number(data.discountAmount ?? 0),
            gstPercent: Number(data.gstPercent ?? settings?.defaultGstPercent ?? 5),
            gstAmount: Number(data.gstAmount ?? 0),
            totalCost: Number(data.totalCost ?? 0),
            inclusions: data.inclusions || '',
            exclusions: data.exclusions || '',
            termsAndConditions: data.termsAndConditions || settings?.quotationTerms || '',
            status: data.status || 'Draft',
            assignedToUid: data.assignedToUid || firebaseUser.uid,
            createdByUid: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          const ref = await addDoc(collection(db, 'quotations'), payload);
          if (data.enquiryId && data.status === 'Sent') {
            await updateDoc(doc(db, 'enquiries', data.enquiryId), {
              status: 'Quotation Sent',
              updatedAt: serverTimestamp(),
            });
          }
          toast('success', `Quotation ${quoteCode} (v${payload.version}) saved.`);
          return ref.id;
        }
      } catch (err) {
        handleFirestoreError(err, id ? OperationType.UPDATE : OperationType.CREATE, 'quotations');
      }
    },
    [firebaseUser, quotations.length, settings, toast]
  );

  const deleteQuotation = useCallback(
    async (id: string) => {
      try {
        await deleteDoc(doc(db, 'quotations', id));
        toast('success', 'Quotation deleted.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `quotations/${id}`);
      }
    },
    [toast]
  );

  const saveBooking = useCallback(
    async (data: Partial<Booking>, id?: string) => {
      if (!firebaseUser) throw new Error('Not authenticated');
      try {
        if (id) {
          const payload = stripUndefined({ ...data, updatedAt: serverTimestamp() });
          delete payload.id;
          delete payload.createdAt;
          delete payload.createdByUid;
          await updateDoc(doc(db, 'bookings', id), payload);
          if (data.bookingStatus === 'Cancelled') {
            await createNotificationInternal(
              `Booking Cancelled: ${data.bookingCode || ''}`,
              `${data.customerName || 'Customer'} booking has been marked Cancelled.`,
              'Cancellation',
              'bookings'
            );
          }
          toast('success', 'Booking updated.');
          return id;
        } else {
          const prefix = settings?.bookingPrefix || 'BK';
          const bookingCode = data.bookingCode || generateCode(prefix, bookings.length);
          const amt = Number(data.bookingAmount ?? 0);
          const adv = Number(data.advanceReceived ?? 0);
          const rem = Math.max(0, amt - adv);
          const payStatus: Booking['paymentStatus'] =
            adv <= 0 ? 'Unpaid' : rem === 0 ? 'Paid' : 'Partial';
          const payload = stripUndefined({
            bookingCode,
            enquiryId: data.enquiryId || '',
            quotationId: data.quotationId || '',
            customerId: data.customerId || '',
            customerName: (data.customerName || '').trim(),
            customerPhone: data.customerPhone || '',
            customerEmail: data.customerEmail || '',
            destination: (data.destination || '').trim(),
            startDate: data.startDate || todayISO(),
            endDate: data.endDate || todayISO(),
            adults: Number(data.adults ?? 2),
            children: Number(data.children ?? 0),
            infants: Number(data.infants ?? 0),
            packageId: data.packageId || '',
            packageName: data.packageName || '',
            hotelId: data.hotelId || '',
            hotelName: data.hotelName || '',
            vehicleId: data.vehicleId || '',
            vehicleDetails: data.vehicleDetails || '',
            bookingAmount: amt,
            advanceReceived: adv,
            remainingAmount: rem,
            paymentStatus: payStatus,
            bookingStatus: data.bookingStatus || 'Confirmed',
            operationsManagerUid: data.operationsManagerUid || firebaseUser.uid,
            operationsManagerName: data.operationsManagerName || currentEmployee?.name || 'Operations',
            assignedToUid: data.assignedToUid || firebaseUser.uid,
            specialNotes: data.specialNotes || '',
            createdByUid: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          const ref = await addDoc(collection(db, 'bookings'), payload);
          await createNotificationInternal(
            `New Booking: ${bookingCode}`,
            `${payload.customerName} booked ${payload.destination}.`,
            'Booking',
            'bookings'
          );
          toast('success', `Booking ${bookingCode} created.`);
          return ref.id;
        }
      } catch (err) {
        handleFirestoreError(err, id ? OperationType.UPDATE : OperationType.CREATE, 'bookings');
      }
    },
    [firebaseUser, currentEmployee, bookings.length, settings, toast, createNotificationInternal]
  );

  const deleteBooking = useCallback(
    async (id: string) => {
      try {
        await deleteDoc(doc(db, 'bookings', id));
        toast('success', 'Booking deleted.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `bookings/${id}`);
      }
    },
    [toast]
  );

  const saveHotel = useCallback(
    async (data: Partial<Hotel>, id?: string) => {
      if (!firebaseUser) throw new Error('Not authenticated');
      try {
        if (id) {
          const payload = stripUndefined({ ...data, updatedAt: serverTimestamp() });
          delete payload.id;
          delete payload.createdAt;
          delete payload.createdByUid;
          await updateDoc(doc(db, 'hotels', id), payload);
          toast('success', 'Hotel updated.');
          return id;
        } else {
          const payload = stripUndefined({
            name: (data.name || '').trim(),
            destination: (data.destination || '').trim(),
            address: data.address || '',
            contactPerson: data.contactPerson || '',
            phone: data.phone || '',
            email: data.email || '',
            category: data.category || 'Deluxe',
            roomTypes: data.roomTypes || ['Standard Room'],
            mealPlans: data.mealPlans || ['CP'],
            contractRate: Number(data.contractRate ?? 0),
            seasonalRate: Number(data.seasonalRate ?? 0),
            checkInTime: data.checkInTime || '14:00',
            checkOutTime: data.checkOutTime || '11:00',
            policies: data.policies || '',
            notes: data.notes || '',
            createdByUid: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          const ref = await addDoc(collection(db, 'hotels'), payload);
          toast('success', `Hotel ${payload.name} added.`);
          return ref.id;
        }
      } catch (err) {
        handleFirestoreError(err, id ? OperationType.UPDATE : OperationType.CREATE, 'hotels');
      }
    },
    [firebaseUser, toast]
  );

  const deleteHotel = useCallback(
    async (id: string) => {
      try {
        await deleteDoc(doc(db, 'hotels', id));
        toast('success', 'Hotel deleted.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `hotels/${id}`);
      }
    },
    [toast]
  );

  const saveVehicle = useCallback(
    async (data: Partial<Vehicle>, id?: string) => {
      if (!firebaseUser) throw new Error('Not authenticated');
      try {
        if (id) {
          const payload = stripUndefined({ ...data, updatedAt: serverTimestamp() });
          delete payload.id;
          delete payload.createdAt;
          delete payload.createdByUid;
          await updateDoc(doc(db, 'vehicles', id), payload);
          toast('success', 'Vehicle updated.');
          return id;
        } else {
          const payload = stripUndefined({
            registrationNumber: (data.registrationNumber || '').trim().toUpperCase(),
            category: data.category || 'Sedan',
            model: (data.model || '').trim(),
            seatingCapacity: Number(data.seatingCapacity ?? 4),
            driverName: data.driverName || '',
            driverPhone: data.driverPhone || '',
            vendorDetails: data.vendorDetails || '',
            perDayRate: Number(data.perDayRate ?? 0),
            perKmRate: Number(data.perKmRate ?? 0),
            availability: data.availability || 'Available',
            assignedBookingCode: data.assignedBookingCode || '',
            maintenanceStatus: data.maintenanceStatus || 'Good',
            createdByUid: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          const ref = await addDoc(collection(db, 'vehicles'), payload);
          toast('success', `Vehicle ${payload.registrationNumber} added.`);
          return ref.id;
        }
      } catch (err) {
        handleFirestoreError(err, id ? OperationType.UPDATE : OperationType.CREATE, 'vehicles');
      }
    },
    [firebaseUser, toast]
  );

  const deleteVehicle = useCallback(
    async (id: string) => {
      try {
        await deleteDoc(doc(db, 'vehicles', id));
        toast('success', 'Vehicle removed.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `vehicles/${id}`);
      }
    },
    [toast]
  );

  const recordPayment = useCallback(
    async (data: {
      type: 'Customer Collection' | 'Refund';
      booking: Booking;
      amount: number;
      gstComponent: number;
      mode: Payment['mode'];
      referenceNumber: string;
      paymentDate: string;
      notes: string;
    }) => {
      if (!firebaseUser) throw new Error('Not authenticated');
      try {
        const receiptCode = generateCode(data.type === 'Refund' ? 'RFD' : 'RCP', payments.length);
        const payRef = doc(collection(db, 'payments'));
        const batch = writeBatch(db);

        batch.set(payRef, {
          receiptCode,
          type: data.type,
          bookingId: data.booking.id,
          bookingCode: data.booking.bookingCode,
          customerId: data.booking.customerId || '',
          customerName: data.booking.customerName,
          amount: data.amount,
          gstComponent: data.gstComponent,
          mode: data.mode,
          referenceNumber: data.referenceNumber || '',
          paymentDate: data.paymentDate || todayISO(),
          notes: data.notes || '',
          recordedByUid: firebaseUser.uid,
          createdAt: serverTimestamp(),
        });

        // Automatically recalculate Booking advanceReceived, remainingAmount & paymentStatus
        const currentAdv = Number(data.booking.advanceReceived || 0);
        const bookingTotal = Number(data.booking.bookingAmount || 0);
        const newAdvance =
          data.type === 'Refund'
            ? Math.max(0, currentAdv - data.amount)
            : currentAdv + data.amount;
        const newRemaining = Math.max(0, bookingTotal - newAdvance);
        const newPayStatus: Booking['paymentStatus'] =
          data.type === 'Refund' && newAdvance === 0
            ? 'Refunded'
            : newAdvance <= 0
            ? 'Unpaid'
            : newRemaining === 0
            ? 'Paid'
            : 'Partial';

        batch.update(doc(db, 'bookings', data.booking.id), {
          advanceReceived: newAdvance,
          remainingAmount: newRemaining,
          paymentStatus: newPayStatus,
          updatedAt: serverTimestamp(),
        });

        // Automatically update Customer totalSpent & outstandingBalance if linked
        if (data.booking.customerId) {
          const cust = customers.find((c) => c.id === data.booking.customerId);
          if (cust) {
            const delta = data.type === 'Refund' ? -data.amount : data.amount;
            const newSpent = Math.max(0, Number(cust.totalSpent || 0) + delta);
            const newOutstanding = Math.max(0, Number(cust.outstandingBalance || 0) - delta);
            batch.update(doc(db, 'customers', cust.id), {
              totalSpent: newSpent,
              outstandingBalance: newOutstanding,
              updatedAt: serverTimestamp(),
            });
          }
        }

        await batch.commit();
        toast('success', `${data.type} ${receiptCode} recorded and balances updated.`);
        return payRef.id;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'payments');
      }
    },
    [firebaseUser, payments.length, customers, toast]
  );

  const deletePayment = useCallback(
    async (id: string) => {
      try {
        await deleteDoc(doc(db, 'payments', id));
        toast('success', 'Payment record deleted.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `payments/${id}`);
      }
    },
    [toast]
  );

  const saveExpense = useCallback(
    async (data: Partial<Expense>, id?: string) => {
      if (!firebaseUser) throw new Error('Not authenticated');
      try {
        const total = Number(data.amount ?? 0);
        const paid = Number(data.paidAmount ?? 0);
        const pending = Math.max(0, total - paid);
        const status: Expense['status'] = paid <= 0 ? 'Pending' : pending === 0 ? 'Paid' : 'Partial';
        if (id) {
          const payload = stripUndefined({
            ...data,
            pendingAmount: pending,
            status,
            updatedAt: serverTimestamp(),
          });
          delete payload.id;
          delete payload.createdAt;
          delete payload.recordedByUid;
          await updateDoc(doc(db, 'expenses', id), payload);
          toast('success', 'Supplier expense updated.');
          return id;
        } else {
          const expenseCode = data.expenseCode || generateCode('EXP', expenses.length);
          const payload = stripUndefined({
            expenseCode,
            category: data.category || 'Hotel Payment',
            vendorName: (data.vendorName || '').trim(),
            bookingCode: data.bookingCode || '',
            amount: total,
            paidAmount: paid,
            pendingAmount: pending,
            mode: data.mode || 'Bank Transfer',
            status,
            dueDate: data.dueDate || todayISO(),
            notes: data.notes || '',
            recordedByUid: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          const ref = await addDoc(collection(db, 'expenses'), payload);
          toast('success', `Expense ${expenseCode} recorded.`);
          return ref.id;
        }
      } catch (err) {
        handleFirestoreError(err, id ? OperationType.UPDATE : OperationType.CREATE, 'expenses');
      }
    },
    [firebaseUser, expenses.length, toast]
  );

  const deleteExpense = useCallback(
    async (id: string) => {
      try {
        await deleteDoc(doc(db, 'expenses', id));
        toast('success', 'Expense deleted.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `expenses/${id}`);
      }
    },
    [toast]
  );

  const saveFollowUp = useCallback(
    async (data: Partial<FollowUp>, id?: string) => {
      if (!firebaseUser) throw new Error('Not authenticated');
      try {
        if (id) {
          const payload = stripUndefined({ ...data, updatedAt: serverTimestamp() });
          delete payload.id;
          delete payload.createdAt;
          delete payload.createdByUid;
          await updateDoc(doc(db, 'followups', id), payload);
          toast('success', 'Follow-up task updated.');
          return id;
        } else {
          const payload = stripUndefined({
            title: (data.title || '').trim(),
            type: data.type || 'Enquiry Follow-up',
            relatedEntityType: data.relatedEntityType || 'general',
            relatedEntityId: data.relatedEntityId || '',
            relatedEntityCode: data.relatedEntityCode || '',
            customerName: data.customerName || '',
            customerPhone: data.customerPhone || '',
            dueDate: data.dueDate || todayISO(),
            reminderTime: data.reminderTime || '10:00',
            priority: data.priority || 'Medium',
            status: data.status || 'Pending',
            assignedToUid: data.assignedToUid || firebaseUser.uid,
            assignedToName: data.assignedToName || currentEmployee?.name || 'Staff',
            notes: data.notes || '',
            history: data.history || [],
            createdByUid: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          const ref = await addDoc(collection(db, 'followups'), payload);
          if (payload.assignedToUid !== firebaseUser.uid) {
            await createNotificationInternal(
              `Task Assigned: ${payload.title}`,
              `Due ${payload.dueDate} (${payload.priority} priority).`,
              'Task',
              'followups',
              payload.assignedToUid
            );
          }
          toast('success', 'Follow-up task scheduled.');
          return ref.id;
        }
      } catch (err) {
        handleFirestoreError(err, id ? OperationType.UPDATE : OperationType.CREATE, 'followups');
      }
    },
    [firebaseUser, currentEmployee, toast, createNotificationInternal]
  );

  const deleteFollowUp = useCallback(
    async (id: string) => {
      try {
        await deleteDoc(doc(db, 'followups', id));
        toast('success', 'Task deleted.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `followups/${id}`);
      }
    },
    [toast]
  );

  const saveEmployee = useCallback(
    async (data: Partial<Employee>, id: string) => {
      try {
        const payload = stripUndefined({ ...data, updatedAt: serverTimestamp() });
        delete payload.id;
        delete payload.createdAt;
        delete payload.uid;
        await updateDoc(doc(db, 'employees', id), payload);
        toast('success', 'Employee profile and permissions updated.');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `employees/${id}`);
      }
    },
    [toast]
  );

  const deleteEmployee = useCallback(
    async (id: string) => {
      try {
        await deleteDoc(doc(db, 'employees', id));
        toast('success', 'Employee access revoked.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `employees/${id}`);
      }
    },
    [toast]
  );

  const inviteEmployee = useCallback(
    async (data: Omit<EmployeeInvite, 'id' | 'invitedByUid' | 'createdAt'>) => {
      if (!firebaseUser) throw new Error('Not authenticated');
      const emailLower = data.email.trim().toLowerCase();
      try {
        await setDoc(doc(db, 'employee_invites', emailLower), {
          email: emailLower,
          name: data.name.trim(),
          phone: data.phone || '',
          role: data.role,
          department: data.department || 'Sales',
          permissions: data.permissions,
          invitedByUid: firebaseUser.uid,
          createdAt: serverTimestamp(),
        });
        toast('success', `Invitation created for ${emailLower}. They can now sign in with Google.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `employee_invites/${emailLower}`);
      }
    },
    [firebaseUser, toast]
  );

  const deleteInvite = useCallback(
    async (email: string) => {
      try {
        await deleteDoc(doc(db, 'employee_invites', email.toLowerCase()));
        toast('success', 'Invitation cancelled.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `employee_invites/${email}`);
      }
    },
    [toast]
  );

  const saveWhatsAppTemplate = useCallback(
    async (data: Partial<WhatsAppTemplate>, id?: string) => {
      try {
        if (id) {
          const payload = stripUndefined({ ...data, updatedAt: serverTimestamp() });
          delete payload.id;
          await updateDoc(doc(db, 'whatsapp_templates', id), payload);
          toast('success', 'WhatsApp template updated.');
        } else {
          await addDoc(collection(db, 'whatsapp_templates'), {
            name: (data.name || '').trim(),
            category: data.category || 'Enquiry Response',
            body: (data.body || '').trim(),
            updatedAt: serverTimestamp(),
          });
          toast('success', 'WhatsApp template created.');
        }
      } catch (err) {
        handleFirestoreError(err, id ? OperationType.UPDATE : OperationType.CREATE, 'whatsapp_templates');
      }
    },
    [toast]
  );

  const deleteWhatsAppTemplate = useCallback(
    async (id: string) => {
      try {
        await deleteDoc(doc(db, 'whatsapp_templates', id));
        toast('success', 'Template deleted.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `whatsapp_templates/${id}`);
      }
    },
    [toast]
  );

  const saveCompanySettings = useCallback(
    async (data: Partial<CompanySettings>) => {
      try {
        const payload = stripUndefined({
          ...(settings || {}),
          ...data,
          companyName: (data.companyName || settings?.companyName || 'Azure Travel').trim(),
          defaultGstPercent: Number(data.defaultGstPercent ?? settings?.defaultGstPercent ?? 5),
          updatedAt: serverTimestamp(),
        });
        await setDoc(doc(db, 'settings', 'company'), payload);
        toast('success', 'Company settings saved.');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'settings/company');
      }
    },
    [settings, toast]
  );

  const markNotificationRead = useCallback(async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${id}`);
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;
    try {
      const batch = writeBatch(db);
      unread.forEach((n) => batch.update(doc(db, 'notifications', n.id), { isRead: true }));
      await batch.commit();
      toast('info', 'All notifications marked as read.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'notifications');
    }
  }, [notifications, toast]);

  const reseedDemoData = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      await seedInitialCRMData(
        firebaseUser.uid,
        currentEmployee?.name || firebaseUser.displayName || 'Admin',
        firebaseUser.email || BOOTSTRAPPED_SUPER_ADMIN_EMAIL
      );
      toast('success', 'Sample CRM records added to database.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'seed');
    }
  }, [firebaseUser, currentEmployee, toast]);

  const value = useMemo<CRMContextValue>(
    () => ({
      firebaseUser,
      authLoading,
      currentEmployee,
      accessDeniedReason,
      activeModule,
      setActiveModule,
      sidebarCollapsed,
      setSidebarCollapsed,
      mobileMenuOpen,
      setMobileMenuOpen,
      darkMode,
      toggleDarkMode,
      login,
      logout,
      can,
      toast,
      enquiries,
      customers,
      packages,
      quotations,
      bookings,
      hotels,
      vehicles,
      payments,
      expenses,
      followUps,
      employees,
      invites,
      notifications,
      whatsappTemplates,
      settings,
      dataLoading,
      draftQuoteEnquiry,
      setDraftQuoteEnquiry,
      saveEnquiry,
      deleteEnquiry,
      addEnquiryActivity,
      convertEnquiryToBooking,
      saveCustomer,
      deleteCustomer,
      savePackage,
      deletePackage,
      saveQuotation,
      deleteQuotation,
      saveBooking,
      deleteBooking,
      saveHotel,
      deleteHotel,
      saveVehicle,
      deleteVehicle,
      recordPayment,
      deletePayment,
      saveExpense,
      deleteExpense,
      saveFollowUp,
      deleteFollowUp,
      saveEmployee,
      deleteEmployee,
      inviteEmployee,
      deleteInvite,
      saveWhatsAppTemplate,
      deleteWhatsAppTemplate,
      saveCompanySettings,
      markNotificationRead,
      markAllNotificationsRead,
      reseedDemoData,
    }),
    [
      firebaseUser,
      authLoading,
      currentEmployee,
      accessDeniedReason,
      activeModule,
      sidebarCollapsed,
      mobileMenuOpen,
      darkMode,
      toggleDarkMode,
      login,
      logout,
      can,
      toast,
      enquiries,
      customers,
      packages,
      quotations,
      bookings,
      hotels,
      vehicles,
      payments,
      expenses,
      followUps,
      employees,
      invites,
      notifications,
      whatsappTemplates,
      settings,
      dataLoading,
      draftQuoteEnquiry,
      saveEnquiry,
      deleteEnquiry,
      addEnquiryActivity,
      convertEnquiryToBooking,
      saveCustomer,
      deleteCustomer,
      savePackage,
      deletePackage,
      saveQuotation,
      deleteQuotation,
      saveBooking,
      deleteBooking,
      saveHotel,
      deleteHotel,
      saveVehicle,
      deleteVehicle,
      recordPayment,
      deletePayment,
      saveExpense,
      deleteExpense,
      saveFollowUp,
      deleteFollowUp,
      saveEmployee,
      deleteEmployee,
      inviteEmployee,
      deleteInvite,
      saveWhatsAppTemplate,
      deleteWhatsAppTemplate,
      saveCompanySettings,
      markNotificationRead,
      markAllNotificationsRead,
      reseedDemoData,
    ]
  );

  return (
    <CRMContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </CRMContext.Provider>
  );
};
