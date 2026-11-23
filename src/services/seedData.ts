import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { getDefaultPermissionsForRole } from '../utils/permissions';

export async function seedInitialCRMData(uid: string, userName: string, userEmail: string) {
  const now = serverTimestamp();

  // Phase 0: Commit Super Admin employee record & company settings first so auth always succeeds
  const coreBatch = writeBatch(db);

  // 1. Company Settings
  coreBatch.set(doc(db, 'settings', 'company'), {
    companyName: 'Azure Travel',
    tagline: 'Bespoke Leisure & Corporate Journeys',
    logoUrl: '/src/assets/images/company_logo_mark_1795419417417.jpg',
    gstNumber: '27AABCA9482K1Z5',
    defaultGstPercent: 5,
    email: 'concierge@azuretravel.in',
    phone: '+91 98204 51200',
    website: 'https://azuretravel.in',
    address: '402 Meridian Trade Tower, Nariman Point, Mumbai 400021',
    invoicePrefix: 'INV',
    quotePrefix: 'QT',
    bookingPrefix: 'BK',
    bankDetails: 'HDFC Bank Ltd · A/C: 50200048192011 · IFSC: HDFC0000142 · Nariman Point Branch',
    upiId: 'azuretravel@hdfcbank',
    quotationTerms:
      '1. Quotation validity is 7 days from issue date.\n2. Hotel rooms and flight fares are subject to availability at the time of confirmation.\n3. 40% advance required to lock confirmed bookings; balance due 14 days prior to departure.\n4. Cancellation charges apply as per hotel and airline policies.',
    invoiceTerms:
      '1. Carry original government photo ID / Passport for check-in.\n2. Standard check-in 14:00 hrs and check-out 11:00 hrs unless specified.\n3. Emergency 24x7 concierge desk: +91 98204 51200.',
    whatsappConfig: {
      enabled: false,
      phoneNumberId: '',
      businessAccountId: '',
      webhookVerifyToken: '',
      apiVersion: 'v21.0',
    },
    notificationPrefs: {
      newEnquiry: true,
      followUpReminders: true,
      newBooking: true,
      pendingPayments: true,
      upcomingDepartures: true,
    },
    updatedAt: now,
  });

  // 2. Super Admin employee record
  coreBatch.set(doc(db, 'employees', uid), {
    uid,
    name: userName || 'Barnabas Sherpa',
    email: userEmail,
    phone: '+91 98204 51200',
    role: 'Super Admin',
    department: 'Executive Management',
    status: 'Active',
    permissions: getDefaultPermissionsForRole('Super Admin'),
    createdAt: now,
    updatedAt: now,
  });

  await coreBatch.commit();

  const batch = writeBatch(db);

  // 3. WhatsApp Templates
  const templates = [
    {
      id: 'tpl_enquiry_resp',
      name: 'Initial Enquiry Greeting',
      category: 'Enquiry Response',
      body: 'Hello {{customerName}}, thank you for contacting Azure Travel regarding your {{destination}} trip ({{startDate}}). Our travel specialist {{executiveName}} is preparing customized options for you. Let us know your preferred time for a quick call.',
    },
    {
      id: 'tpl_followup',
      name: 'Quotation Follow-up',
      category: 'Follow-up',
      body: 'Hi {{customerName}}, checking in on the {{destination}} proposal we shared. Would you like any adjustments to the hotels, meal plan, or sightseeing itinerary?',
    },
    {
      id: 'tpl_quote_share',
      name: 'Quotation Summary Share',
      category: 'Quotation Sharing',
      body: 'Dear {{customerName}}, please find your {{destination}} quotation ({{quoteCode}}) totaling {{totalCost}}. Valid for 7 days. Reply YES to confirm your reservation.',
    },
    {
      id: 'tpl_booking_conf',
      name: 'Booking Confirmation',
      category: 'Booking Confirmation',
      body: 'Congratulations {{customerName}}! Your {{destination}} trip ({{bookingCode}}) from {{startDate}} to {{endDate}} is confirmed. Your travel voucher has been generated.',
    },
    {
      id: 'tpl_payment_rem',
      name: 'Balance Payment Reminder',
      category: 'Payment Reminder',
      body: 'Dear {{customerName}}, this is a gentle reminder for the remaining balance of {{remainingAmount}} on booking {{bookingCode}} ({{destination}}). UPI: azuretravel@hdfcbank.',
    },
    {
      id: 'tpl_tour_rem',
      name: 'Pre-Departure Checklist',
      category: 'Tour Reminder',
      body: 'Warm greetings from Azure Travel! Your {{destination}} departure ({{startDate}}) is approaching. Please keep your IDs and vouchers handy. Driver details will be shared 24 hours before pickup.',
    },
  ];
  templates.forEach(({ id, ...tplData }) => {
    batch.set(doc(db, 'whatsapp_templates', id), { ...tplData, updatedAt: now });
  });

  // 4. Hotels
  const hotel1Ref = doc(collection(db, 'hotels'));
  const hotel2Ref = doc(collection(db, 'hotels'));
  const hotel3Ref = doc(collection(db, 'hotels'));
  const hotel4Ref = doc(collection(db, 'hotels'));

  batch.set(hotel1Ref, {
    name: 'Taj Lake Palace',
    destination: 'Udaipur, Rajasthan',
    address: 'Pichola Lake, Udaipur, Rajasthan 313001',
    contactPerson: 'Vikram Rathore',
    phone: '+91 294 242 8800',
    email: 'reservations.udaipur@tajhotels.com',
    category: 'Luxury',
    roomTypes: ['Luxury Lake View', 'Palace Room', 'Royal Suite'],
    mealPlans: ['CP', 'MAP', 'AP'],
    contractRate: 32000,
    seasonalRate: 44000,
    checkInTime: '14:00',
    checkOutTime: '12:00',
    policies: '7 days prior cancellation free during off-peak. Boat transfer included from Bansi Ghat.',
    notes: 'Preferred partner for honeymoon & VIP luxury itineraries.',
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(hotel2Ref, {
    name: 'Kumarakom Lake Resort',
    destination: 'Kerala Backwaters',
    address: 'Kumarakom North Post, Kottayam, Kerala 686563',
    contactPerson: 'Meera Nair',
    phone: '+91 481 252 4900',
    email: 'sales@kumarakomlakeresort.in',
    category: 'Luxury',
    roomTypes: ['Heritage Villa', 'Meandering Pool Villa', 'Presidential Suite'],
    mealPlans: ['CP', 'MAP', 'AP'],
    contractRate: 18500,
    seasonalRate: 25000,
    checkInTime: '14:00',
    checkOutTime: '11:00',
    policies: 'Sunset cruise complimentary at 17:00.',
    notes: 'Ayurvedic spa packages earn 15% agency commission.',
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(hotel3Ref, {
    name: 'Grand Hotel Zermatterhof',
    destination: 'Zermatt, Switzerland',
    address: 'Bahnhofstrasse 55, 3920 Zermatt, Switzerland',
    contactPerson: 'Lukas Meier',
    phone: '+41 27 966 66 00',
    email: 'groups@zermatterhof.ch',
    category: 'Premium',
    roomTypes: ['Alpine Double', 'Matterhorn Junior Suite'],
    mealPlans: ['BB', 'HB'],
    contractRate: 28000,
    seasonalRate: 36000,
    checkInTime: '15:00',
    checkOutTime: '11:00',
    policies: 'Electric carriage transfer from Zermatt railway station.',
    notes: 'Book 45 days ahead for Matterhorn-facing balconies.',
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(hotel4Ref, {
    name: 'The Thousand Kyoto',
    destination: 'Kyoto, Japan',
    address: '570 Higashishiokojicho, Shimogyo Ward, Kyoto',
    contactPerson: 'Kenji Sato',
    phone: '+81 75 354 1000',
    email: 'reservations@thousandkyoto.jp',
    category: 'Premium',
    roomTypes: ['Premier King', 'Deluxe Twin', 'Japanese Suite'],
    mealPlans: ['EP', 'CP'],
    contractRate: 21000,
    seasonalRate: 29500,
    checkInTime: '15:00',
    checkOutTime: '12:00',
    policies: '2 minutes walk from JR Kyoto Central Exit.',
    notes: 'Peak cherry blossom & autumn foliage surcharge applies.',
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  // 5. Vehicles
  const veh1Ref = doc(collection(db, 'vehicles'));
  const veh2Ref = doc(collection(db, 'vehicles'));
  const veh3Ref = doc(collection(db, 'vehicles'));

  batch.set(veh1Ref, {
    registrationNumber: 'MH-01-TR-4821',
    category: 'Crysta',
    model: 'Toyota Innova Crysta ZX',
    seatingCapacity: 6,
    driverName: 'Rajesh Sharma',
    driverPhone: '+91 98211 40291',
    vendorDetails: 'Azure Owned Fleet',
    perDayRate: 4200,
    perKmRate: 22,
    availability: 'On Trip',
    assignedBookingCode: 'BK-2026-001',
    maintenanceStatus: 'Good',
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(veh2Ref, {
    registrationNumber: 'KL-05-AV-9012',
    category: 'Tempo Traveller',
    model: 'Force Urbania 12-Seater Executive',
    seatingCapacity: 12,
    driverName: 'Suresh Menon',
    driverPhone: '+91 94471 88210',
    vendorDetails: 'Malabar Coach Partners',
    perDayRate: 6800,
    perKmRate: 32,
    availability: 'Available',
    assignedBookingCode: '',
    maintenanceStatus: 'Good',
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(veh3Ref, {
    registrationNumber: 'RJ-27-LX-1109',
    category: 'Luxury Vehicles',
    model: 'Mercedes-Benz E-Class LWB',
    seatingCapacity: 3,
    driverName: 'Mahendra Singh',
    driverPhone: '+91 98290 77312',
    vendorDetails: 'Heritage Chauffeur Guild',
    perDayRate: 14500,
    perKmRate: 65,
    availability: 'Reserved',
    assignedBookingCode: 'BK-2026-002',
    maintenanceStatus: 'Due Soon',
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  // 6. Tour Packages (using generated local images)
  const pkg1Ref = doc(collection(db, 'packages'));
  const pkg2Ref = doc(collection(db, 'packages'));
  const pkg3Ref = doc(collection(db, 'packages'));
  const pkg4Ref = doc(collection(db, 'packages'));

  batch.set(pkg1Ref, {
    packageCode: 'PKG-001',
    name: 'Swiss Alpine Rail & Glacier Panorama',
    destination: 'Switzerland',
    days: 7,
    nights: 6,
    description:
      'Scenic rail journey linking Zurich, Lucerne, Interlaken, and Zermatt aboard the Glacier Express with Mount Titlis and Jungfraujoch excursions.',
    highlights: [
      'First-class Swiss Travel Pass & Glacier Express',
      'Jungfraujoch Top of Europe cogwheel excursion',
      'Lake Lucerne sunset cruise',
    ],
    itinerary: [
      { day: 1, title: 'Arrival in Zurich & Transfer to Lucerne', description: 'Meet & greet at Zurich Airport, scenic train to Lucerne.', meals: 'Breakfast', stay: 'Lucerne 4* Boutique' },
      { day: 2, title: 'Mount Titlis & Lake Lucerne Cruise', description: 'Rotair cable car to 3,020m summit and evening lake boat ride.', meals: 'Breakfast', stay: 'Lucerne 4* Boutique' },
      { day: 3, title: 'Lucerne to Interlaken via GoldenPass', description: 'Panoramic train across Brunig Pass into the Bernese Oberland.', meals: 'Breakfast', stay: 'Interlaken' },
    ],
    hotelDetails: '4-Star & 5-Star Alpine Hotels with breakfast',
    vehicleDetails: 'Swiss Travel Pass 1st Class + Private Station Transfers',
    inclusions: '6 nights accommodation, daily breakfast, Swiss Travel Pass, Jungfraujoch & Titlis tickets.',
    exclusions: 'International airfare, Schengen visa fee, lunches & personal expenses.',
    price: 185000,
    childPrice: 128000,
    seasonalPrice: 215000,
    imageUrl: '/src/assets/images/package_swiss_alps_1795419417673.jpg',
    termsAndConditions: 'Valid passport with 6 months validity required. Visa processing takes 15 working days.',
    isActive: true,
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(pkg2Ref, {
    packageCode: 'PKG-002',
    name: 'Emerald Kerala Backwaters & Munnar Mist',
    destination: 'Kerala',
    days: 6,
    nights: 5,
    description:
      'Discover tea-carpeted hills in Munnar, wildlife trails in Thekkady, and a private luxury houseboat cruise through Alleppey backwaters.',
    highlights: [
      'Private 1-night luxury AC Kettuvallam houseboat',
      'Eravikulam National Park & tea tasting',
      'Kathakali evening cultural performance',
    ],
    itinerary: [
      { day: 1, title: 'Cochin Arrival to Munnar', description: 'Scenic drive past Cheeyappara waterfalls to Munnar tea estates.', meals: 'Breakfast, Dinner', stay: 'Munnar Hill Resort' },
      { day: 2, title: 'Munnar Sightseeing', description: 'Mattupetty Dam, Echo Point, and Tea Museum tour.', meals: 'Breakfast, Dinner', stay: 'Munnar Hill Resort' },
      { day: 3, title: 'Thekkady Spice Plantations', description: 'Periyar lake boat safari and spice walk.', meals: 'Breakfast, Dinner', stay: 'Thekkady' },
    ],
    hotelDetails: '5-Star Heritage Resorts + Premium Houseboat',
    vehicleDetails: 'Private Toyota Innova Crysta throughout',
    inclusions: '5 nights stay, MAP meals, houseboat all meals, private Innova Crysta.',
    exclusions: 'Airfare, camera fees, Ayurvedic treatments.',
    price: 54000,
    childPrice: 28000,
    seasonalPrice: 68000,
    imageUrl: '/src/assets/images/package_kerala_backwaters_1795419417816.jpg',
    termsAndConditions: 'Houseboat check-in 12:00 noon, AC operates 21:00 to 06:00 in bedrooms.',
    isActive: true,
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(pkg3Ref, {
    packageCode: 'PKG-003',
    name: 'Kyoto & Tokyo Cultural Heritage Trail',
    destination: 'Japan',
    days: 8,
    nights: 7,
    description:
      'Immerse in Japan’s timeless contrast of Kyoto’s historic machiya alleys, Nara’s ancient shrines, Hakone’s Mt. Fuji views, and Tokyo.',
    highlights: [
      'Shinkansen bullet train Kyoto to Tokyo',
      'Private tea ceremony in Gion district',
      'Hakone Lake Ashi cruise & Mt. Fuji viewpoint',
    ],
    itinerary: [
      { day: 1, title: 'Arrive Tokyo & Shinkansen to Kyoto', description: 'Airport limo & bullet train transfer straight to Kyoto.', meals: 'Breakfast', stay: 'The Thousand Kyoto' },
      { day: 2, title: 'Kyoto Golden Pavilion & Arashiyama', description: 'Kinkaku-ji, Bamboo Grove, and Fushimi Inari Shrine.', meals: 'Breakfast', stay: 'The Thousand Kyoto' },
    ],
    hotelDetails: '4-Star Superior City & Ryokan Stays',
    vehicleDetails: '7-Day JR Rail Pass + Private Airport Transfers',
    inclusions: '7 nights stay, daily breakfast, JR Pass, guided tours.',
    exclusions: 'Flights, Japan visa, personal shopping.',
    price: 210000,
    childPrice: 155000,
    seasonalPrice: 248000,
    imageUrl: '/src/assets/images/package_kyoto_heritage_1795419417572.jpg',
    termsAndConditions: 'Cherry blossom season bookings non-refundable within 30 days.',
    isActive: true,
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(pkg4Ref, {
    packageCode: 'PKG-004',
    name: 'Royal Udaipur & Jaipur Palace Escape',
    destination: 'Rajasthan',
    days: 5,
    nights: 4,
    description:
      'Experience royal Rajasthani hospitality with lakeside palace stays in Udaipur, City Palace heritage tours, and Amber Fort in Jaipur.',
    highlights: [
      'Sunset boat cruise on Lake Pichola',
      'Private vintage car heritage transfer',
      'Royal Rajasthani courtyard dining',
    ],
    itinerary: [
      { day: 1, title: 'Arrival in Udaipur', description: 'Lake Pichola sunset cruise and palace check-in.', meals: 'Breakfast, Dinner', stay: 'Taj Lake Palace' },
      { day: 2, title: 'City Palace & Bagore Ki Haveli', description: 'Guided architectural walk and folk dance evening.', meals: 'Breakfast', stay: 'Taj Lake Palace' },
    ],
    hotelDetails: 'Heritage 5-Star Palace Properties',
    vehicleDetails: 'Chauffeur-driven Luxury Sedan / SUV',
    inclusions: '4 nights luxury stay, breakfast, boat ride, monument entries.',
    exclusions: 'Flights, tips, alcoholic beverages.',
    price: 92000,
    childPrice: 46000,
    seasonalPrice: 124000,
    imageUrl: '/src/assets/images/package_rajasthan_palace_1795419418580.jpg',
    termsAndConditions: 'Standard heritage property rules apply.',
    isActive: true,
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  // 7. Customers
  const cust1Ref = doc(collection(db, 'customers'));
  const cust2Ref = doc(collection(db, 'customers'));
  const cust3Ref = doc(collection(db, 'customers'));

  batch.set(cust1Ref, {
    customerCode: 'CUS-2026-001',
    name: 'Aarav & Priya Malhotra',
    mobile: '+91 98201 33412',
    whatsapp: '+91 98201 33412',
    email: 'aarav.malhotra@example.com',
    address: '14B Seaface Residency, Worli',
    city: 'Mumbai',
    preferences: 'Vegetarian meals, high-floor quiet rooms, window seats',
    specialRequests: 'Anniversary cake setup at Lake Pichola',
    internalRemarks: 'Repeat VIP couple. Always prefers Luxury category.',
    documents: [],
    totalBookings: 1,
    totalSpent: 125000,
    outstandingBalance: 65000,
    assignedToUid: uid,
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(cust2Ref, {
    customerCode: 'CUS-2026-002',
    name: 'Rohan Deshmukh',
    mobile: '+91 97650 88219',
    whatsapp: '+91 97650 88219',
    email: 'rohan.deshmukh@example.com',
    address: '204 Koregaon Park Annexe',
    city: 'Pune',
    preferences: 'Boutique resorts, early check-in when travelling with kids',
    specialRequests: 'Child car seat for 4-year-old',
    internalRemarks: 'Referred by Malhotra family.',
    documents: [],
    totalBookings: 1,
    totalSpent: 112000,
    outstandingBalance: 0,
    assignedToUid: uid,
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(cust3Ref, {
    customerCode: 'CUS-2026-003',
    name: 'Siddharth & Kavya Nair',
    mobile: '+91 99451 67201',
    whatsapp: '+91 99451 67201',
    email: 'siddharth.nair@example.com',
    address: '88 Indiranagar 100ft Road',
    city: 'Bengaluru',
    preferences: 'Scenic trains, boutique hotels, cultural walks',
    specialRequests: 'Vegetarian friendly dining recommendations in Kyoto',
    internalRemarks: 'High intent for Japan autumn itinerary.',
    documents: [],
    totalBookings: 1,
    totalSpent: 150000,
    outstandingBalance: 270000,
    assignedToUid: uid,
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  // 8. Enquiries
  const todayStr = new Date().toISOString().slice(0, 10);
  const enq1Ref = doc(collection(db, 'enquiries'));
  const enq2Ref = doc(collection(db, 'enquiries'));
  const enq3Ref = doc(collection(db, 'enquiries'));
  const enq4Ref = doc(collection(db, 'enquiries'));

  batch.set(enq1Ref, {
    enquiryCode: 'ENQ-2026-001',
    customerId: cust1Ref.id,
    customerName: 'Aarav & Priya Malhotra',
    mobile: '+91 98201 33412',
    whatsapp: '+91 98201 33412',
    email: 'aarav.malhotra@example.com',
    source: 'Referral',
    destination: 'Udaipur, Rajasthan',
    startDate: '2026-12-05',
    endDate: '2026-12-09',
    adults: 2,
    children: 0,
    infants: 0,
    rooms: 1,
    hotelCategory: 'Luxury',
    budget: 200000,
    preferredVehicle: 'Luxury Vehicles',
    specialRequirements: 'Lake-facing palace suite with anniversary dinner.',
    assignedToUid: uid,
    assignedToName: userName || 'Barnabas Sherpa',
    enquiryDate: '2026-11-10',
    followUpDate: todayStr,
    status: 'Booking Confirmed',
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(enq2Ref, {
    enquiryCode: 'ENQ-2026-002',
    customerId: cust3Ref.id,
    customerName: 'Siddharth & Kavya Nair',
    mobile: '+91 99451 67201',
    whatsapp: '+91 99451 67201',
    email: 'siddharth.nair@example.com',
    source: 'Google',
    destination: 'Kyoto & Tokyo, Japan',
    startDate: '2026-12-18',
    endDate: '2026-12-25',
    adults: 2,
    children: 0,
    infants: 0,
    rooms: 1,
    hotelCategory: 'Premium',
    budget: 450000,
    preferredVehicle: 'Rail Pass + Private Sedan',
    specialRequirements: 'Tea ceremony + vegetarian restaurant list.',
    assignedToUid: uid,
    assignedToName: userName || 'Barnabas Sherpa',
    enquiryDate: '2026-11-18',
    followUpDate: todayStr,
    status: 'Quotation Sent',
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(enq3Ref, {
    enquiryCode: 'ENQ-2026-003',
    customerName: 'Neha Kapoor',
    mobile: '+91 98112 70452',
    whatsapp: '+91 98112 70452',
    email: 'neha.kapoor@example.com',
    source: 'Instagram',
    destination: 'Switzerland',
    startDate: '2027-01-12',
    endDate: '2027-01-19',
    adults: 4,
    children: 2,
    infants: 0,
    rooms: 2,
    hotelCategory: 'Premium',
    budget: 950000,
    preferredVehicle: 'Swiss Travel Pass',
    specialRequirements: 'Family ski lesson option in Zermatt + connecting rooms.',
    assignedToUid: uid,
    assignedToName: userName || 'Barnabas Sherpa',
    enquiryDate: '2026-11-21',
    followUpDate: todayStr,
    status: 'Follow-up Required',
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(enq4Ref, {
    enquiryCode: 'ENQ-2026-004',
    customerName: 'Vikramaditya Joshi',
    mobile: '+91 98230 11904',
    whatsapp: '+91 98230 11904',
    email: 'vikram.joshi@example.com',
    source: 'Website',
    destination: 'Kerala Backwaters',
    startDate: '2026-12-28',
    endDate: '2027-01-02',
    adults: 6,
    children: 1,
    infants: 0,
    rooms: 3,
    hotelCategory: 'Deluxe',
    budget: 340000,
    preferredVehicle: 'Tempo Traveller',
    specialRequirements: 'New Year gala dinner included.',
    assignedToUid: uid,
    assignedToName: userName || 'Barnabas Sherpa',
    enquiryDate: todayStr,
    followUpDate: todayStr,
    status: 'New Enquiry',
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  // Activity subcollection for Enquiry 1 will be written in batch2 after enq1Ref commits

  // 9. Quotations
  const qt1Ref = doc(collection(db, 'quotations'));
  const qt2Ref = doc(collection(db, 'quotations'));

  batch.set(qt1Ref, {
    quoteCode: 'QT-2026-001',
    version: 2,
    enquiryId: enq1Ref.id,
    customerId: cust1Ref.id,
    customerName: 'Aarav & Priya Malhotra',
    customerEmail: 'aarav.malhotra@example.com',
    customerPhone: '+91 98201 33412',
    destination: 'Udaipur, Rajasthan',
    startDate: '2026-12-05',
    endDate: '2026-12-09',
    paxSummary: '2 Adults · 1 Room',
    hotelItems: [
      { hotelId: hotel1Ref.id, hotelName: 'Taj Lake Palace', roomType: 'Luxury Lake View', mealPlan: 'MAP', nights: 4, rooms: 1, ratePerNight: 32000, total: 128000 },
    ],
    transportItems: [
      { vehicleId: veh3Ref.id, vehicleCategory: 'Luxury Vehicles', vehicleModel: 'Mercedes-Benz E-Class LWB', days: 5, ratePerDay: 6500, total: 32500 },
    ],
    sightseeingCharge: 12000,
    mealsCharge: 8500,
    otherExpenses: 4000,
    subtotal: 185000,
    markupPercent: 8,
    markupAmount: 14800,
    discountAmount: 18848,
    gstPercent: 5,
    gstAmount: 9048,
    totalCost: 190000,
    inclusions: '4 nights palace stay, daily breakfast & dinner, private airport transfers, Lake Pichola sunset cruise.',
    exclusions: 'Airfare, personal spa charges, tips.',
    termsAndConditions: '40% advance upon confirmation.',
    status: 'Accepted',
    assignedToUid: uid,
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(qt2Ref, {
    quoteCode: 'QT-2026-002',
    version: 1,
    enquiryId: enq2Ref.id,
    customerId: cust3Ref.id,
    customerName: 'Siddharth & Kavya Nair',
    customerEmail: 'siddharth.nair@example.com',
    customerPhone: '+91 99451 67201',
    destination: 'Kyoto & Tokyo, Japan',
    startDate: '2026-12-18',
    endDate: '2026-12-25',
    paxSummary: '2 Adults · 1 Room',
    hotelItems: [
      { hotelId: hotel4Ref.id, hotelName: 'The Thousand Kyoto', roomType: 'Premier King', mealPlan: 'CP', nights: 7, rooms: 1, ratePerNight: 24000, total: 168000 },
    ],
    transportItems: [
      { vehicleCategory: 'Sedan', vehicleModel: '7-Day JR Green Pass + Private Sedan Transfers', days: 7, ratePerDay: 14000, total: 98000 },
    ],
    sightseeingCharge: 72000,
    mealsCharge: 22000,
    otherExpenses: 15000,
    subtotal: 375000,
    markupPercent: 10,
    markupAmount: 37500,
    discountAmount: 12500,
    gstPercent: 5,
    gstAmount: 20000,
    totalCost: 420000,
    inclusions: '7 nights 4*/5* stays, breakfast, JR Pass, Gion tea ceremony, Mt. Fuji excursion.',
    exclusions: 'International flights, Japan visa fee.',
    termsAndConditions: 'Quote valid for 7 days.',
    status: 'Sent',
    assignedToUid: uid,
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  // 10. Bookings
  const bk1Ref = doc(collection(db, 'bookings'));
  const bk2Ref = doc(collection(db, 'bookings'));
  const bk3Ref = doc(collection(db, 'bookings'));

  batch.set(bk1Ref, {
    bookingCode: 'BK-2026-001',
    enquiryId: enq1Ref.id,
    quotationId: qt1Ref.id,
    customerId: cust1Ref.id,
    customerName: 'Aarav & Priya Malhotra',
    customerPhone: '+91 98201 33412',
    customerEmail: 'aarav.malhotra@example.com',
    destination: 'Udaipur, Rajasthan',
    startDate: '2026-12-05',
    endDate: '2026-12-09',
    adults: 2,
    children: 0,
    infants: 0,
    packageId: pkg4Ref.id,
    packageName: 'Royal Udaipur & Jaipur Palace Escape',
    hotelId: hotel1Ref.id,
    hotelName: 'Taj Lake Palace',
    vehicleId: veh3Ref.id,
    vehicleDetails: 'Mercedes-Benz E-Class LWB (RJ-27-LX-1109)',
    bookingAmount: 190000,
    advanceReceived: 125000,
    remainingAmount: 65000,
    paymentStatus: 'Partial',
    bookingStatus: 'Confirmed',
    operationsManagerUid: uid,
    operationsManagerName: userName || 'Barnabas Sherpa',
    assignedToUid: uid,
    specialNotes: 'VIP Anniversary dinner setup requested for Dec 6.',
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(bk2Ref, {
    bookingCode: 'BK-2026-002',
    customerId: cust2Ref.id,
    customerName: 'Rohan Deshmukh',
    customerPhone: '+91 97650 88219',
    customerEmail: 'rohan.deshmukh@example.com',
    destination: 'Kerala Backwaters',
    startDate: '2026-11-20',
    endDate: '2026-11-25',
    adults: 2,
    children: 1,
    infants: 0,
    packageId: pkg2Ref.id,
    packageName: 'Emerald Kerala Backwaters & Munnar Mist',
    hotelId: hotel2Ref.id,
    hotelName: 'Kumarakom Lake Resort',
    vehicleId: veh1Ref.id,
    vehicleDetails: 'Toyota Innova Crysta ZX (MH-01-TR-4821)',
    bookingAmount: 112000,
    advanceReceived: 112000,
    remainingAmount: 0,
    paymentStatus: 'Paid',
    bookingStatus: 'In Progress',
    operationsManagerUid: uid,
    operationsManagerName: userName || 'Barnabas Sherpa',
    assignedToUid: uid,
    specialNotes: 'Child car seat installed.',
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(bk3Ref, {
    bookingCode: 'BK-2026-003',
    enquiryId: enq2Ref.id,
    quotationId: qt2Ref.id,
    customerId: cust3Ref.id,
    customerName: 'Siddharth & Kavya Nair',
    customerPhone: '+91 99451 67201',
    customerEmail: 'siddharth.nair@example.com',
    destination: 'Kyoto & Tokyo, Japan',
    startDate: '2026-12-18',
    endDate: '2026-12-25',
    adults: 2,
    children: 0,
    infants: 0,
    packageId: pkg3Ref.id,
    packageName: 'Kyoto & Tokyo Cultural Heritage Trail',
    hotelId: hotel4Ref.id,
    hotelName: 'The Thousand Kyoto',
    vehicleId: '',
    vehicleDetails: '7-Day JR Green Pass + Private Sedan',
    bookingAmount: 420000,
    advanceReceived: 150000,
    remainingAmount: 270000,
    paymentStatus: 'Partial',
    bookingStatus: 'Confirmed',
    operationsManagerUid: uid,
    operationsManagerName: userName || 'Barnabas Sherpa',
    assignedToUid: uid,
    specialNotes: 'JR Pass voucher dispatch due Dec 04.',
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  // 11. Payments will be written in batch2 after bk1Ref..bk3Ref commit

  // 12. Expenses
  const exp1Ref = doc(collection(db, 'expenses'));
  const exp2Ref = doc(collection(db, 'expenses'));

  batch.set(exp1Ref, {
    expenseCode: 'EXP-2026-001',
    category: 'Hotel Payment',
    vendorName: 'Taj Lake Palace Udaipur',
    bookingCode: 'BK-2026-001',
    amount: 115000,
    paidAmount: 60000,
    pendingAmount: 55000,
    mode: 'Bank Transfer',
    status: 'Partial',
    dueDate: '2026-11-28',
    notes: '50% hotel advance paid; balance due 7 days before check-in.',
    recordedByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(exp2Ref, {
    expenseCode: 'EXP-2026-002',
    category: 'Transport Payment',
    vendorName: 'Malabar Coach Partners',
    bookingCode: 'BK-2026-002',
    amount: 24500,
    paidAmount: 24500,
    pendingAmount: 0,
    mode: 'UPI',
    status: 'Paid',
    dueDate: '2026-11-19',
    notes: 'Settled for Kerala tour.',
    recordedByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  // 13. Follow-ups
  const fu1Ref = doc(collection(db, 'followups'));
  const fu2Ref = doc(collection(db, 'followups'));
  const fu3Ref = doc(collection(db, 'followups'));

  batch.set(fu1Ref, {
    title: 'Follow up with Neha Kapoor on Switzerland Family Quote',
    type: 'Enquiry Follow-up',
    relatedEntityType: 'enquiry',
    relatedEntityId: enq3Ref.id,
    relatedEntityCode: 'ENQ-2026-003',
    customerName: 'Neha Kapoor',
    customerPhone: '+91 98112 70452',
    dueDate: todayStr,
    reminderTime: '11:30',
    priority: 'High',
    status: 'Pending',
    assignedToUid: uid,
    assignedToName: userName || 'Barnabas Sherpa',
    notes: 'Confirm ski instructor availability in Zermatt.',
    history: [],
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(fu2Ref, {
    title: 'Collect balance ₹65,000 for Udaipur Palace Booking',
    type: 'Payment Reminder',
    relatedEntityType: 'booking',
    relatedEntityId: bk1Ref.id,
    relatedEntityCode: 'BK-2026-001',
    customerName: 'Aarav & Priya Malhotra',
    customerPhone: '+91 98201 33412',
    dueDate: todayStr,
    reminderTime: '15:00',
    priority: 'Urgent',
    status: 'Pending',
    assignedToUid: uid,
    assignedToName: userName || 'Barnabas Sherpa',
    notes: 'Send UPI / NEFT details along with confirmed boat transfer voucher.',
    history: [],
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(fu3Ref, {
    title: 'Call Vikramaditya Joshi regarding Kerala Group Dates',
    type: 'Enquiry Follow-up',
    relatedEntityType: 'enquiry',
    relatedEntityId: enq4Ref.id,
    relatedEntityCode: 'ENQ-2026-004',
    customerName: 'Vikramaditya Joshi',
    customerPhone: '+91 98230 11904',
    dueDate: '2026-11-20',
    reminderTime: '10:00',
    priority: 'High',
    status: 'Pending',
    assignedToUid: uid,
    assignedToName: userName || 'Barnabas Sherpa',
    notes: 'Verify room sharing split for 6 adults + 1 child.',
    history: [],
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  // 14. Notifications
  const not1Ref = doc(collection(db, 'notifications'));
  const not2Ref = doc(collection(db, 'notifications'));
  batch.set(not1Ref, {
    title: 'New Website Enquiry Received',
    message: 'Vikramaditya Joshi requested a Kerala Backwaters quote for 7 guests.',
    category: 'Enquiry',
    targetUid: 'all',
    isRead: false,
    linkModule: 'enquiries',
    createdByUid: uid,
    createdAt: now,
  });
  batch.set(not2Ref, {
    title: 'Upcoming Departure: Kerala Backwaters',
    message: 'BK-2026-002 (Rohan Deshmukh) is currently In Progress with Kumarakom Lake Resort.',
    category: 'Departure',
    targetUid: 'all',
    isRead: false,
    linkModule: 'bookings',
    createdByUid: uid,
    createdAt: now,
  });

  await batch.commit();

  // Commit dependent subcollections and booking-linked payments after parent documents exist
  const batch2 = writeBatch(db);
  batch2.set(doc(collection(db, 'enquiries', enq1Ref.id, 'activities')), {
    type: 'Call',
    content: 'Spoke with Aarav. Confirmed 4 nights at Taj Lake Palace with Lake View room.',
    authorUid: uid,
    authorName: userName || 'Barnabas Sherpa',
    createdAt: now,
  });

  const pay1Ref = doc(collection(db, 'payments'));
  const pay2Ref = doc(collection(db, 'payments'));
  const pay3Ref = doc(collection(db, 'payments'));

  batch2.set(pay1Ref, {
    receiptCode: 'RCP-2026-001',
    type: 'Customer Collection',
    bookingId: bk1Ref.id,
    bookingCode: 'BK-2026-001',
    customerId: cust1Ref.id,
    customerName: 'Aarav & Priya Malhotra',
    amount: 125000,
    gstComponent: 5952,
    mode: 'Bank Transfer',
    referenceNumber: 'NEFT-884920112',
    paymentDate: '2026-11-12',
    notes: 'Booking advance deposit received.',
    recordedByUid: uid,
    createdAt: now,
  });

  batch2.set(pay2Ref, {
    receiptCode: 'RCP-2026-002',
    type: 'Customer Collection',
    bookingId: bk2Ref.id,
    bookingCode: 'BK-2026-002',
    customerId: cust2Ref.id,
    customerName: 'Rohan Deshmukh',
    amount: 112000,
    gstComponent: 5333,
    mode: 'UPI',
    referenceNumber: 'UPI-6642091827',
    paymentDate: '2026-11-08',
    notes: 'Full settlement received prior to Kerala departure.',
    recordedByUid: uid,
    createdAt: now,
  });

  batch2.set(pay3Ref, {
    receiptCode: 'RCP-2026-003',
    type: 'Customer Collection',
    bookingId: bk3Ref.id,
    bookingCode: 'BK-2026-003',
    customerId: cust3Ref.id,
    customerName: 'Siddharth & Kavya Nair',
    amount: 150000,
    gstComponent: 7143,
    mode: 'Credit/Debit Card',
    referenceNumber: 'PG-RAZOR-99124',
    paymentDate: '2026-11-19',
    notes: 'Initial token deposit for Kyoto hotel lock.',
    recordedByUid: uid,
    createdAt: now,
  });

  await batch2.commit();
}
