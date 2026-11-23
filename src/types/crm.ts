export type UserRole =
  | 'Super Admin'
  | 'Admin'
  | 'Sales Manager'
  | 'Sales Executive'
  | 'Operations Manager'
  | 'Accounts Manager'
  | 'Customer Support';

export type ModuleKey =
  | 'dashboard'
  | 'enquiries'
  | 'customers'
  | 'packages'
  | 'quotations'
  | 'bookings'
  | 'hotels'
  | 'vehicles'
  | 'payments'
  | 'followups'
  | 'reports'
  | 'employees'
  | 'whatsapp'
  | 'notifications'
  | 'settings';

export interface ModulePermission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export type PermissionMap = Record<ModuleKey, ModulePermission>;

export interface Employee {
  id: string;
  uid: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  department?: string;
  status: 'Active' | 'Inactive';
  permissions: PermissionMap;
  createdAt?: any;
  updatedAt?: any;
}

export interface EmployeeInvite {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  department?: string;
  permissions: PermissionMap;
  invitedByUid: string;
  createdAt?: any;
}

export type EnquirySource =
  | 'Website'
  | 'Facebook'
  | 'Instagram'
  | 'Google'
  | 'Referral'
  | 'Justdial'
  | 'Tour Travel World'
  | 'Walk-in'
  | 'Other';

export type HotelCategory = 'Standard' | 'Deluxe' | 'Premium' | 'Luxury';
export type HotelRegion = 'Sikkim' | 'Darjeeling' | 'Bhutan';
export type HotelAvailability = 'Available' | 'Limited' | 'Sold Out';
export type MealPlanCode = 'EP' | 'CP' | 'MAP' | 'AP';

export type EnquiryStatus =
  | 'New Enquiry'
  | 'Contacted'
  | 'Follow-up Required'
  | 'Quotation Sent'
  | 'Negotiation'
  | 'Booking Confirmed'
  | 'Lost'
  | 'Cancelled';

export interface Enquiry {
  id: string;
  enquiryCode: string;
  customerId?: string;
  customerName: string;
  mobile: string;
  whatsapp?: string;
  email?: string;
  source: EnquirySource;
  destination: string;
  startDate?: string;
  endDate?: string;
  adults: number;
  children?: number;
  infants?: number;
  rooms?: number;
  hotelCategory: HotelCategory;
  budget: number;
  preferredVehicle?: string;
  specialRequirements?: string;
  assignedToUid: string;
  assignedToName?: string;
  enquiryDate: string;
  followUpDate?: string;
  status: EnquiryStatus;
  createdByUid: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface EnquiryActivity {
  id: string;
  type: 'Note' | 'Call' | 'WhatsApp' | 'Email' | 'Status Change' | 'Quotation';
  content: string;
  authorUid: string;
  authorName: string;
  createdAt?: any;
}

export interface CustomerDocument {
  name: string;
  type: string;
  url: string;
  uploadedAt: string;
}

export interface Customer {
  id: string;
  customerCode: string;
  name: string;
  mobile: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  city?: string;
  preferences?: string;
  specialRequests?: string;
  internalRemarks?: string;
  documents?: CustomerDocument[];
  totalBookings: number;
  totalSpent: number;
  outstandingBalance: number;
  assignedToUid: string;
  createdByUid: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ItineraryDay {
  day: number;
  title: string;
  description: string;
  meals: string;
  stay: string;
}

export interface TourPackage {
  id: string;
  packageCode: string;
  name: string;
  destination: string;
  targetRegions?: string[];
  selectedHotelIds?: string[];
  days: number;
  nights: number;
  description?: string;
  highlights?: string[];
  itinerary?: ItineraryDay[];
  hotelDetails?: string;
  vehicleDetails?: string;
  inclusions?: string;
  exclusions?: string;
  price: number;
  childPrice?: number;
  seasonalPrice?: number;
  imageUrl?: string;
  termsAndConditions?: string;
  isActive: boolean;
  createdByUid: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface QuotationHotelItem {
  hotelId?: string;
  hotelName: string;
  region?: string;
  city?: string;
  roomType: string;
  mealPlan: string;
  nights: number;
  rooms: number;
  ratePerNight: number;
  total: number;
}

export interface QuotationTransportItem {
  vehicleId?: string;
  vehicleCategory: string;
  vehicleModel: string;
  days: number;
  ratePerDay: number;
  total: number;
}

export type QuotationStatus = 'Draft' | 'Sent' | 'Viewed' | 'Revised' | 'Accepted' | 'Rejected';

export interface Quotation {
  id: string;
  quoteCode: string;
  version: number;
  enquiryId?: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  destination: string;
  startDate?: string;
  endDate?: string;
  paxSummary?: string;
  hotelItems?: QuotationHotelItem[];
  transportItems?: QuotationTransportItem[];
  sightseeingCharge?: number;
  mealsCharge?: number;
  otherExpenses?: number;
  subtotal: number;
  markupPercent?: number;
  markupAmount?: number;
  discountAmount?: number;
  gstPercent?: number;
  gstAmount?: number;
  totalCost: number;
  inclusions?: string;
  exclusions?: string;
  termsAndConditions?: string;
  status: QuotationStatus;
  assignedToUid: string;
  createdByUid: string;
  createdAt?: any;
  updatedAt?: any;
}

export type PaymentStatus = 'Unpaid' | 'Partial' | 'Paid' | 'Refunded';
export type BookingStatus = 'Pending' | 'Confirmed' | 'In Progress' | 'Completed' | 'Cancelled';

export interface BookingHotelSelection {
  hotelId?: string;
  hotelName: string;
  region?: string;
  city?: string;
}

export interface Booking {
  id: string;
  bookingCode: string;
  enquiryId?: string;
  quotationId?: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  destination: string;
  startDate: string;
  endDate: string;
  adults: number;
  children?: number;
  infants?: number;
  packageId?: string;
  packageName?: string;
  hotelId?: string;
  hotelName?: string;
  selectedHotels?: BookingHotelSelection[];
  vehicleId?: string;
  vehicleDetails?: string;
  bookingAmount: number;
  advanceReceived: number;
  remainingAmount: number;
  paymentStatus: PaymentStatus;
  bookingStatus: BookingStatus;
  operationsManagerUid?: string;
  operationsManagerName?: string;
  assignedToUid: string;
  specialNotes?: string;
  createdByUid: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Hotel {
  id: string;
  hotelCode?: string;
  name: string;
  country?: 'India' | 'Bhutan';
  region?: HotelRegion;
  city?: string;
  destination: string;
  address?: string;
  contactPerson?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  category: HotelCategory;
  roomTypes?: string[];
  totalRooms?: number;
  mealPlans?: string[];
  contractRate: number;
  seasonalRate?: number;
  peakSeasonRate?: number;
  offSeasonRate?: number;
  checkInTime?: string;
  checkOutTime?: string;
  facilities?: string[];
  mapLocationUrl?: string;
  images?: string[];
  policies?: string;
  notes?: string;
  availability?: HotelAvailability;
  isActive?: boolean;
  createdByUid: string;
  createdAt?: any;
  updatedAt?: any;
}

export type VehicleCategory =
  | 'Hatchback'
  | 'Sedan'
  | 'SUV'
  | 'Innova'
  | 'Crysta'
  | 'Tempo Traveller'
  | 'Sumo'
  | 'Mahindra Bolero Maxx'
  | 'Luxury Vehicles';

export interface Vehicle {
  id: string;
  registrationNumber: string;
  category: VehicleCategory;
  model: string;
  seatingCapacity: number;
  driverName?: string;
  driverPhone?: string;
  vendorDetails?: string;
  perDayRate: number;
  perKmRate?: number;
  availability: 'Available' | 'On Trip' | 'Reserved' | 'Maintenance';
  assignedBookingCode?: string;
  maintenanceStatus: 'Good' | 'Due Soon' | 'In Service';
  createdByUid: string;
  createdAt?: any;
  updatedAt?: any;
}

export type PaymentMode = 'Cash' | 'UPI' | 'Bank Transfer' | 'Credit/Debit Card' | 'Payment Gateway';

export interface Payment {
  id: string;
  receiptCode: string;
  type: 'Customer Collection' | 'Refund';
  bookingId: string;
  bookingCode?: string;
  customerId?: string;
  customerName: string;
  amount: number;
  gstComponent?: number;
  mode: PaymentMode;
  referenceNumber?: string;
  paymentDate: string;
  notes?: string;
  recordedByUid: string;
  createdAt?: any;
}

export type InvoiceType = 'Tax Invoice' | 'Proforma Invoice';
export type InvoiceStatus = 'Draft' | 'Issued' | 'Partial' | 'Paid' | 'Cancelled';

export interface InvoiceItem {
  description: string;
  hsnSac?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceCode: string;
  invoiceType: InvoiceType;
  bookingId?: string;
  bookingCode?: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerGstin?: string;
  destination?: string;
  travelDates?: string;
  issueDate: string;
  dueDate?: string;
  items: InvoiceItem[];
  subtotal: number;
  discountAmount?: number;
  gstPercent: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: InvoiceStatus;
  notes?: string;
  termsAndConditions?: string;
  createdByUid: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Expense {
  id: string;
  expenseCode: string;
  category: 'Hotel Payment' | 'Transport Payment' | 'Sightseeing/Vendor' | 'Office/Marketing' | 'Other';
  vendorName: string;
  bookingCode?: string;
  amount: number;
  paidAmount: number;
  pendingAmount: number;
  mode?: PaymentMode;
  status: 'Pending' | 'Partial' | 'Paid';
  dueDate?: string;
  notes?: string;
  recordedByUid: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface FollowUpHistoryItem {
  note: string;
  by: string;
  at: string;
}

export interface FollowUp {
  id: string;
  title: string;
  type: 'Enquiry Follow-up' | 'Payment Reminder' | 'Pre-Tour Check' | 'Post-Tour Feedback' | 'Internal Task';
  relatedEntityType?: 'enquiry' | 'booking' | 'customer' | 'general';
  relatedEntityId?: string;
  relatedEntityCode?: string;
  customerName?: string;
  customerPhone?: string;
  dueDate: string;
  reminderTime?: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Pending' | 'Completed';
  assignedToUid: string;
  assignedToName?: string;
  notes?: string;
  history?: FollowUpHistoryItem[];
  createdByUid: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: 'Enquiry' | 'Follow-up' | 'Booking' | 'Payment' | 'Departure' | 'Cancellation' | 'Task';
  targetUid?: string;
  isRead: boolean;
  linkModule?: ModuleKey;
  createdByUid: string;
  createdAt?: any;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  category:
    | 'Enquiry Response'
    | 'Follow-up'
    | 'Quotation Sharing'
    | 'Booking Confirmation'
    | 'Payment Reminder'
    | 'Tour Reminder';
  body: string;
  updatedAt?: any;
}

export interface CompanySettings {
  companyName: string;
  tagline?: string;
  logoUrl?: string;
  currency?: string;
  currencySymbol?: string;
  gstNumber?: string;
  defaultGstPercent: number;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  invoicePrefix?: string;
  quotePrefix?: string;
  bookingPrefix?: string;
  bankDetails?: string;
  upiId?: string;
  quotationTerms?: string;
  invoiceTerms?: string;
  whatsappConfig?: {
    enabled: boolean;
    phoneNumberId: string;
    businessAccountId: string;
    webhookVerifyToken: string;
    apiVersion: string;
  };
  notificationPrefs?: {
    newEnquiry: boolean;
    followUpReminders: boolean;
    newBooking: boolean;
    pendingPayments: boolean;
    upcomingDepartures: boolean;
  };
  updatedAt?: any;
}
