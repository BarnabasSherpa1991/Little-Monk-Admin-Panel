import { collection, doc, getDocs, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { getDefaultPermissionsForRole } from '../utils/permissions';

export async function seedInitialCRMData(uid: string, userName: string, userEmail: string) {
  const now = serverTimestamp();

  // Phase 0: Commit Super Admin employee record & company settings first so auth always succeeds
  const coreBatch = writeBatch(db);

  // 1. Company Settings (preserve if already configured by checking first)
  const existingSettingsSnap = await getDocs(collection(db, 'settings'));
  const existingCompanyDoc = existingSettingsSnap.docs.find((d) => d.id === 'company');
  if (!existingCompanyDoc) {
    coreBatch.set(doc(db, 'settings', 'company'), {
      companyName: 'Little Monk Travels',
      tagline: 'Eastern Himalayas & Bhutan Specialists',
      logoUrl: '/assets/aistudio/Screenshot_2026-11-23_132939_51fcd266.png',
      currency: 'INR',
      currencySymbol: '₹',
      gstNumber: '19AABCA9482K1Z5',
      defaultGstPercent: 5,
      email: 'concierge@littlemonktravels.in',
      phone: '+91 98204 51200',
      website: 'https://littlemonktravels.in',
      address: '2nd Floor, Hill Cart Road, Siliguri, West Bengal 734001',
      invoicePrefix: 'INV',
      quotePrefix: 'QT',
      bookingPrefix: 'BK',
      bankDetails: 'HDFC Bank Ltd · A/C: 50200048192011 · IFSC: HDFC0000142 · Siliguri Branch',
      upiId: 'littlemonktravels@hdfcbank',
      quotationTerms:
        '1. Quotation validity is 7 days from issue date.\n2. Hotel rooms and permits (Nathula, North Sikkim, Bhutan SDF) are subject to availability and government regulations.\n3. 40% advance required to lock confirmed bookings; balance due 14 days prior to departure.\n4. Cancellation charges apply as per hotel and transport partner policies.',
      invoiceTerms:
        '1. Carry original Voter ID / Passport (mandatory for Sikkim Protected Area Permits & Bhutan immigration).\n2. Standard check-in 14:00 hrs and check-out 11:00 hrs unless specified.\n3. Emergency 24x7 concierge desk: +91 98204 51200.',
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
  } else {
    const existingData = existingCompanyDoc.data();
    const isLegacyBrand = /azur[ae]\s*travel/i.test(String(existingData.companyName || ''));
    const isLegacyLogo =
      !existingData.logoUrl ||
      String(existingData.logoUrl).includes('company_logo_mark') ||
      String(existingData.logoUrl) === '/assets/images/little_monk_logo.jpg';
    await setDoc(
      doc(db, 'settings', 'company'),
      {
        currency: 'INR',
        currencySymbol: '₹',
        ...(isLegacyBrand ? { companyName: 'Little Monk Travels' } : {}),
        ...(isLegacyLogo
          ? { logoUrl: '/assets/aistudio/Screenshot_2026-11-23_132939_51fcd266.png' }
          : {}),
        ...(existingData.email === 'concierge@azuretravel.in'
          ? { email: 'concierge@littlemonktravels.in' }
          : {}),
        ...(existingData.website === 'https://azuretravel.in'
          ? { website: 'https://littlemonktravels.in' }
          : {}),
        ...(existingData.upiId === 'azuretravel@hdfcbank'
          ? { upiId: 'littlemonktravels@hdfcbank' }
          : {}),
        updatedAt: now,
      },
      { merge: true }
    );
  }

  // 2. Super Admin employee record (only create if absent)
  const existingEmpSnap = await getDocs(collection(db, 'employees'));
  const hasSuperAdminDoc = existingEmpSnap.docs.some((d) => d.id === uid);
  if (!hasSuperAdminDoc) {
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
  }

  await coreBatch.commit();

  // Check existing collections before writing demo records to avoid duplicates
  const [
    existingHotelsSnap,
    existingTemplatesSnap,
    existingVehiclesSnap,
    existingPackagesSnap,
    existingCustomersSnap,
    existingEnquiriesSnap,
    existingBookingsSnap,
    existingInvoicesSnap,
  ] = await Promise.all([
    getDocs(collection(db, 'hotels')),
    getDocs(collection(db, 'whatsapp_templates')),
    getDocs(collection(db, 'vehicles')),
    getDocs(collection(db, 'packages')),
    getDocs(collection(db, 'customers')),
    getDocs(collection(db, 'enquiries')),
    getDocs(collection(db, 'bookings')),
    getDocs(collection(db, 'invoices')),
  ]);

  const existingHotelNames = new Set(
    existingHotelsSnap.docs.map((d) => String(d.data().name || '').trim().toLowerCase())
  );

  const batch = writeBatch(db);

  // 3. WhatsApp Templates (only if empty)
  if (existingTemplatesSnap.empty) {
    const templates = [
      {
        id: 'tpl_enquiry_resp',
        name: 'Initial Enquiry Greeting',
        category: 'Enquiry Response',
        body: 'Hello {{customerName}}, thank you for contacting Little Monk Travels regarding your {{destination}} trip ({{startDate}}). Our Himalayan travel specialist {{executiveName}} is preparing customized options for you. Let us know a convenient time for a quick call.',
      },
      {
        id: 'tpl_followup',
        name: 'Quotation Follow-up',
        category: 'Follow-up',
        body: 'Hi {{customerName}}, checking in on the {{destination}} proposal we shared. Would you like any adjustments to the hotels, meal plan, or sightseeing permits?',
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
        body: 'Congratulations {{customerName}}! Your {{destination}} trip ({{bookingCode}}) from {{startDate}} to {{endDate}} is confirmed. Your hotel voucher and permit checklist have been generated.',
      },
      {
        id: 'tpl_payment_rem',
        name: 'Balance Payment Reminder',
        category: 'Payment Reminder',
        body: 'Dear {{customerName}}, this is a gentle reminder for the remaining balance of {{remainingAmount}} on booking {{bookingCode}} ({{destination}}). UPI: littlemonktravels@hdfcbank.',
      },
      {
        id: 'tpl_tour_rem',
        name: 'Pre-Departure Checklist',
        category: 'Tour Reminder',
        body: 'Warm greetings from Little Monk Travels! Your {{destination}} departure ({{startDate}}) is approaching. Please carry original photo IDs/passports for permit clearance. Driver details will be shared 24 hours before pickup.',
      },
    ];
    templates.forEach(({ id, ...tplData }) => {
      batch.set(doc(db, 'whatsapp_templates', id), { ...tplData, updatedAt: now });
    });
  }

  // 4. Target-Destination Partner Hotels (Sikkim, Darjeeling, Bhutan) — skip any duplicate name
  const seedHotels = [
    {
      name: 'Mayfair Spa Resort & Casino',
      country: 'India',
      region: 'Sikkim',
      city: 'Gangtok',
      destination: 'Gangtok, Sikkim',
      address: 'Lower Samdur Block, Ranipool, Gangtok, Sikkim 737135',
      contactPerson: 'Tenzing Bhutia',
      phone: '+91 3592 250 555',
      whatsapp: '+91 98320 44110',
      email: 'reservations.gangtok@mayfairhotels.com',
      category: 'Luxury',
      roomTypes: ['Deluxe Cottage', 'Family Room', 'Imperial Villa'],
      totalRooms: 88,
      mealPlans: ['CP', 'MAP', 'AP'],
      contractRate: 14500,
      seasonalRate: 18500,
      peakSeasonRate: 22000,
      offSeasonRate: 11500,
      checkInTime: '14:00',
      checkOutTime: '12:00',
      facilities: ['Wi-Fi', 'Mountain View', 'Parking', 'Restaurant', 'Room Heater', '24x7 Hot Water', 'Spa & Wellness'],
      mapLocationUrl: 'https://maps.google.com/?q=Mayfair+Spa+Resort+Gangtok',
      images: ['/src/assets/images/package_swiss_alps_1795419417673.jpg'],
      policies: '7 days free cancellation in off-season; 15 days in peak season (Apr-Jun, Oct-Dec).',
      notes: 'Flagship luxury forest resort near Gangtok with casino and heated wellness spa.',
      availability: 'Available',
      isActive: true,
    },
    {
      name: 'The Chumbi Mountain Retreat & Spa',
      country: 'India',
      region: 'Sikkim',
      city: 'Pelling',
      destination: 'Pelling, Sikkim',
      address: 'Naku Pelling, West Sikkim 737113',
      contactPerson: 'Pemba Sherpa',
      phone: '+91 3595 258 240',
      whatsapp: '+91 97331 55200',
      email: 'sales@chumbimountainretreat.com',
      category: 'Premium',
      roomTypes: ['Deluxe Room', 'Kanchenjunga View Suite', 'Family Suite'],
      totalRooms: 42,
      mealPlans: ['CP', 'MAP', 'AP'],
      contractRate: 7800,
      seasonalRate: 9800,
      peakSeasonRate: 12000,
      offSeasonRate: 6500,
      checkInTime: '13:00',
      checkOutTime: '11:00',
      facilities: ['Wi-Fi', 'Mountain View', 'Parking', 'Restaurant', 'Room Heater', '24x7 Hot Water', 'Spa & Wellness'],
      mapLocationUrl: 'https://maps.google.com/?q=Chumbi+Mountain+Retreat+Pelling',
      images: ['/src/assets/images/package_swiss_alps_1795419417673.jpg'],
      policies: 'Panoramic Mt. Kanchenjunga facing rooms allocated on early confirmation.',
      notes: 'Top partner property for West Sikkim & Pelling Skywalk tours.',
      availability: 'Available',
      isActive: true,
    },
    {
      name: 'Windamere Hotel Heritage',
      country: 'India',
      region: 'Darjeeling',
      city: 'Darjeeling',
      destination: 'Darjeeling, Darjeeling',
      address: 'Observatory Hill, Chauk Bazaar, Darjeeling, West Bengal 734101',
      contactPerson: 'Anjali Rai',
      phone: '+91 354 225 4041',
      whatsapp: '+91 98324 10900',
      email: 'reservations@windamerehotel.com',
      category: 'Luxury',
      roomTypes: ['Heritage Cottage', 'Colonial Suite', 'Little Pelling Suite'],
      totalRooms: 36,
      mealPlans: ['CP', 'MAP', 'AP'],
      contractRate: 13000,
      seasonalRate: 16500,
      peakSeasonRate: 19500,
      offSeasonRate: 10800,
      checkInTime: '14:00',
      checkOutTime: '11:00',
      facilities: ['Wi-Fi', 'Mountain View', 'Restaurant', 'Room Heater', '24x7 Hot Water', 'Bonfire / Lawn'],
      mapLocationUrl: 'https://maps.google.com/?q=Windamere+Hotel+Darjeeling',
      images: ['/src/assets/images/package_swiss_alps_1795419417673.jpg'],
      policies: 'Includes classic Darjeeling afternoon high tea on the terrace.',
      notes: 'Iconic colonial heritage property on Observatory Hill.',
      availability: 'Limited',
      isActive: true,
    },
    {
      name: 'Mayfair Himalayan Spa Resort',
      country: 'India',
      region: 'Darjeeling',
      city: 'Kalimpong',
      destination: 'Kalimpong, Darjeeling',
      address: 'Upper Cart Road, Kalimpong, West Bengal 734301',
      contactPerson: 'Rohan Lepcha',
      phone: '+91 3552 255 600',
      whatsapp: '+91 98321 77420',
      email: 'reservations.kalimpong@mayfairhotels.com',
      category: 'Premium',
      roomTypes: ['Deluxe Room', 'Executive Suite', 'Family Suite'],
      totalRooms: 48,
      mealPlans: ['CP', 'MAP', 'AP'],
      contractRate: 9200,
      seasonalRate: 11500,
      peakSeasonRate: 14000,
      offSeasonRate: 7800,
      checkInTime: '14:00',
      checkOutTime: '12:00',
      facilities: ['Wi-Fi', 'Mountain View', 'Parking', 'Restaurant', 'Room Heater', '24x7 Hot Water', 'Spa & Wellness'],
      mapLocationUrl: 'https://maps.google.com/?q=Mayfair+Himalayan+Spa+Resort+Kalimpong',
      images: ['/src/assets/images/package_swiss_alps_1795419417673.jpg'],
      policies: 'Complimentary welcome drink and orchid garden walk.',
      notes: 'Ideal stopover linking Bagdogra/Siliguri to Gangtok or Darjeeling.',
      availability: 'Available',
      isActive: true,
    },
    {
      name: 'Taj Tashi Bhutan',
      country: 'Bhutan',
      region: 'Bhutan',
      city: 'Thimphu',
      destination: 'Thimphu, Bhutan',
      address: 'Samten Lam, Chubachu, Thimphu 11001, Bhutan',
      contactPerson: 'Karma Dorji',
      phone: '+975 2 336 699',
      whatsapp: '+975 1711 2200',
      email: 'reservations.thimphu@tajhotels.com',
      category: 'Luxury',
      roomTypes: ['Deluxe Room', 'Luxury Room', 'Executive Suite'],
      totalRooms: 66,
      mealPlans: ['CP', 'MAP', 'AP'],
      contractRate: 24000,
      seasonalRate: 30000,
      peakSeasonRate: 35000,
      offSeasonRate: 19500,
      checkInTime: '14:00',
      checkOutTime: '12:00',
      facilities: ['Wi-Fi', 'Mountain View', 'Parking', 'Restaurant', 'Room Heater', '24x7 Hot Water', 'Spa & Wellness', 'Elevator'],
      mapLocationUrl: 'https://maps.google.com/?q=Taj+Tashi+Thimphu+Bhutan',
      images: ['/src/assets/images/package_swiss_alps_1795419417673.jpg'],
      policies: 'Rates in INR excluding Bhutan SDF; 21 days prior cancellation in spring/autumn.',
      notes: 'Premier Dzong-architecture luxury stay in central Thimphu.',
      availability: 'Available',
      isActive: true,
    },
    {
      name: 'Zhiwa Ling Heritage',
      country: 'Bhutan',
      region: 'Bhutan',
      city: 'Paro',
      destination: 'Paro, Bhutan',
      address: 'Satsam Chorten, Paro Valley 12001, Bhutan',
      contactPerson: 'Sonam Wangchuk',
      phone: '+975 8 271 277',
      whatsapp: '+975 1712 4590',
      email: 'sales@zhiwaling.com',
      category: 'Luxury',
      roomTypes: ['Junior Suite', 'Raven Suite', 'Royal Bhutanese Villa'],
      totalRooms: 45,
      mealPlans: ['CP', 'MAP', 'AP'],
      contractRate: 22500,
      seasonalRate: 28500,
      peakSeasonRate: 33000,
      offSeasonRate: 18000,
      checkInTime: '14:00',
      checkOutTime: '11:00',
      facilities: ['Wi-Fi', 'Mountain View', 'Parking', 'Restaurant', 'Room Heater', '24x7 Hot Water', 'Spa & Wellness', 'Bonfire / Lawn'],
      mapLocationUrl: 'https://maps.google.com/?q=Zhiwa+Ling+Heritage+Paro+Bhutan',
      images: ['/src/assets/images/package_swiss_alps_1795419417673.jpg'],
      policies: '15 mins drive from Tiger Nest base trailhead.',
      notes: 'Traditional hand-carved Bhutanese timber architecture; preferred for Paro stays.',
      availability: 'Available',
      isActive: true,
    },
  ];

  const hotelRefs: any[] = [];
  seedHotels.forEach((h) => {
    const ref = doc(collection(db, 'hotels'));
    hotelRefs.push({ ref, data: h });
    if (!existingHotelNames.has(h.name.trim().toLowerCase())) {
      batch.set(ref, {
        ...h,
        createdByUid: uid,
        createdAt: now,
        updatedAt: now,
      });
    }
  });

  // 3b. Ensure Non-Luxury Sumo & Mahindra Bolero Maxx fleet options exist (non-destructive if absent)
  const existingVehicleRegs = new Set(
    existingVehiclesSnap.docs.map((d) => String(d.data().registrationNumber || '').trim().toUpperCase())
  );
  const existingVehicleCats = new Set(
    existingVehiclesSnap.docs.map((d) => String(d.data().category || '').trim())
  );

  const nonLuxuryHillVehicles = [
    {
      registrationNumber: 'SK-01-TR-2204',
      category: 'Sumo',
      model: 'Tata Sumo Gold (Hill Permit)',
      seatingCapacity: 9,
      driverName: 'Dawa Lepcha',
      driverPhone: '+91 98324 61205',
      vendorDetails: 'Little Monk Himalayan Fleet',
      perDayRate: 3200,
      perKmRate: 18,
      availability: 'Available',
      assignedBookingCode: '',
      maintenanceStatus: 'Good',
    },
    {
      registrationNumber: 'WB-73-M-5518',
      category: 'Mahindra Bolero Maxx',
      model: 'Mahindra Bolero Maxx (Mountain Utility)',
      seatingCapacity: 9,
      driverName: 'Suresh Rai',
      driverPhone: '+91 97331 44980',
      vendorDetails: 'Siliguri Darjeeling Cab Union',
      perDayRate: 3000,
      perKmRate: 17,
      availability: 'Available',
      assignedBookingCode: '',
      maintenanceStatus: 'Good',
    },
  ];

  nonLuxuryHillVehicles.forEach((v) => {
    if (!existingVehicleRegs.has(v.registrationNumber) && !existingVehicleCats.has(v.category)) {
      batch.set(doc(collection(db, 'vehicles')), {
        ...v,
        createdByUid: uid,
        createdAt: now,
        updatedAt: now,
      });
    }
  });

  // If business records already exist (reseed triggered later), only add missing demo hotels/non-luxury fleet & stop cleanly without duplicating enquiries/bookings/customers
  const hasExistingBusinessRecords =
    !existingPackagesSnap.empty ||
    !existingCustomersSnap.empty ||
    !existingEnquiriesSnap.empty ||
    !existingBookingsSnap.empty;

  if (hasExistingBusinessRecords) {
    await batch.commit();
    return;
  }

  // 5. Vehicles
  const veh1Ref = doc(collection(db, 'vehicles'));
  const veh2Ref = doc(collection(db, 'vehicles'));
  const veh3Ref = doc(collection(db, 'vehicles'));

  if (existingVehiclesSnap.empty) {
    batch.set(veh1Ref, {
      registrationNumber: 'SK-01-J-4821',
      category: 'Crysta',
      model: 'Toyota Innova Crysta ZX (Hill Permit)',
      seatingCapacity: 6,
      driverName: 'Passang Bhutia',
      driverPhone: '+91 98320 40291',
      vendorDetails: 'Little Monk Himalayan Fleet',
      perDayRate: 4800,
      perKmRate: 24,
      availability: 'On Trip',
      assignedBookingCode: 'BK-2026-001',
      maintenanceStatus: 'Good',
      createdByUid: uid,
      createdAt: now,
      updatedAt: now,
    });

    batch.set(veh2Ref, {
      registrationNumber: 'WB-73-T-9012',
      category: 'SUV',
      model: 'Mahindra Xylo / Scorpio Hill Edition',
      seatingCapacity: 7,
      driverName: 'Bikash Tamang',
      driverPhone: '+91 94341 88210',
      vendorDetails: 'Siliguri Darjeeling Cab Union',
      perDayRate: 4200,
      perKmRate: 22,
      availability: 'Available',
      assignedBookingCode: '',
      maintenanceStatus: 'Good',
      createdByUid: uid,
      createdAt: now,
      updatedAt: now,
    });

    batch.set(veh3Ref, {
      registrationNumber: 'BP-1-A-1109',
      category: 'SUV',
      model: 'Toyota Prado / Land Cruiser Bhutan',
      seatingCapacity: 5,
      driverName: 'Kinley Tobgay',
      driverPhone: '+975 1711 77312',
      vendorDetails: 'Paro Thimphu Luxury Transport',
      perDayRate: 8500,
      perKmRate: 40,
      availability: 'Reserved',
      assignedBookingCode: 'BK-2026-003',
      maintenanceStatus: 'Good',
      createdByUid: uid,
      createdAt: now,
      updatedAt: now,
    });
  }

  // 6. Tour Packages (Sikkim, Darjeeling, Bhutan)
  const pkg1Ref = doc(collection(db, 'packages'));
  const pkg2Ref = doc(collection(db, 'packages'));
  const pkg3Ref = doc(collection(db, 'packages'));

  batch.set(pkg1Ref, {
    packageCode: 'PKG-001',
    name: 'Gangtok, Tsomgo & Pelling Himalayan Escape',
    destination: 'Sikkim',
    targetRegions: ['Sikkim'],
    selectedHotelIds: [hotelRefs[0].ref.id, hotelRefs[1].ref.id],
    days: 6,
    nights: 5,
    description:
      'Explore East and West Sikkim including Tsomgo Lake, Baba Mandir, Ravangla Buddha Park, Pelling Skywalk, and Pemayangtse Monastery.',
    highlights: [
      'Tsomgo Lake & Baba Harbhajan Singh Mandir excursion',
      'Kanchenjunga sunrise views from Pelling',
      'Stay at Mayfair Gangtok & Chumbi Mountain Retreat',
    ],
    itinerary: [
      { day: 1, title: 'Bagdogra / NJP Arrival to Gangtok', description: 'Scenic Teesta river valley drive to Gangtok.', meals: 'Dinner', stay: 'Mayfair Spa Resort & Casino, Gangtok' },
      { day: 2, title: 'Tsomgo Lake & Baba Mandir', description: 'High-altitude glacial lake excursion with permit assistance.', meals: 'Breakfast, Dinner', stay: 'Mayfair Spa Resort & Casino, Gangtok' },
      { day: 3, title: 'Gangtok to Pelling via Namchi', description: 'Visit Siddheshwar Dham & Buddha Park en route to Pelling.', meals: 'Breakfast, Dinner', stay: 'The Chumbi Mountain Retreat, Pelling' },
    ],
    hotelDetails: 'Mayfair Spa Resort & Casino (Gangtok) · The Chumbi Mountain Retreat & Spa (Pelling)',
    vehicleDetails: 'Exclusive Toyota Innova Crysta throughout',
    inclusions: '5 nights stay, MAP meals, exclusive Innova Crysta, Tsomgo permit charges.',
    exclusions: 'Flights/train tickets, Nathula Pass permit surcharge, personal expenses.',
    price: 46500,
    childPrice: 24500,
    seasonalPrice: 54000,
    imageUrl: '/src/assets/images/package_swiss_alps_1795419417673.jpg',
    termsAndConditions: 'Carry original photo ID & 2 passport photos per guest for Sikkim permits.',
    isActive: true,
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(pkg2Ref, {
    packageCode: 'PKG-002',
    name: 'Darjeeling Queen of Hills & Kalimpong Retreat',
    destination: 'Darjeeling',
    targetRegions: ['Darjeeling'],
    selectedHotelIds: [hotelRefs[2].ref.id, hotelRefs[3].ref.id],
    days: 5,
    nights: 4,
    description:
      'Classic heritage tea-garden circuit featuring Tiger Hill sunrise, Himalayan Toy Train ride, Happy Valley Tea Estate, and peaceful Kalimpong.',
    highlights: [
      'Tiger Hill sunrise over Mt. Kanchenjunga',
      'Darjeeling Himalayan Railway Joy Ride',
      'Heritage high-tea at Windamere Hotel & Kalimpong monasteries',
    ],
    itinerary: [
      { day: 1, title: 'Bagdogra Arrival to Darjeeling', description: 'Hill drive past Kurseong tea estates to Darjeeling.', meals: 'Breakfast, Dinner', stay: 'Windamere Hotel Heritage, Darjeeling' },
      { day: 2, title: 'Tiger Hill & Darjeeling Town Tour', description: 'Early morning sunrise, Batasia Loop, HMI & Tea Estate.', meals: 'Breakfast, Dinner', stay: 'Windamere Hotel Heritage, Darjeeling' },
      { day: 3, title: 'Darjeeling to Kalimpong', description: 'Visit Deolo Hill, Pine View Nursery & Zang Dhok Palri.', meals: 'Breakfast, Dinner', stay: 'Mayfair Himalayan Spa Resort, Kalimpong' },
    ],
    hotelDetails: 'Windamere Hotel Heritage (Darjeeling) · Mayfair Himalayan Spa Resort (Kalimpong)',
    vehicleDetails: 'Private Innova / SUV from Bagdogra / NJP',
    inclusions: '4 nights luxury stay, MAP meals, all sightseeing transfers.',
    exclusions: 'Airfare, Toy Train tickets (subject to IRCTC slot), personal tips.',
    price: 38500,
    childPrice: 19500,
    seasonalPrice: 45000,
    imageUrl: '/src/assets/images/package_kerala_backwaters_1795419417816.jpg',
    termsAndConditions: 'Standard hotel check-in/check-out policies apply.',
    isActive: true,
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(pkg3Ref, {
    packageCode: 'PKG-003',
    name: 'Kingdom of Happiness: Thimphu, Punakha & Paro',
    destination: 'Bhutan',
    targetRegions: ['Bhutan'],
    selectedHotelIds: [hotelRefs[4].ref.id, hotelRefs[5].ref.id],
    days: 7,
    nights: 6,
    description:
      'Discover the Land of the Thunder Dragon across Thimphu Buddha Point, Dochula Pass 108 Chortens, Punakha Dzong, and Paro Tiger Nest Monastery.',
    highlights: [
      'Dochula Pass 360-degree Himalayan panorama',
      'Guided trek to Paro Taktsang (Tiger Nest)',
      'Stay at Taj Tashi Thimphu & Zhiwa Ling Heritage Paro',
    ],
    itinerary: [
      { day: 1, title: 'Arrive Paro Airport & Drive to Thimphu', description: 'Welcome by Bhutanese guide and transfer along Paro Chhu river.', meals: 'Breakfast, Dinner', stay: 'Taj Tashi Bhutan, Thimphu' },
      { day: 2, title: 'Thimphu Sightseeing & Dochula Excursion', description: 'Buddha Dordenma, Tashichho Dzong & Folk Heritage Museum.', meals: 'Breakfast, Dinner', stay: 'Taj Tashi Bhutan, Thimphu' },
      { day: 5, title: 'Paro Taktsang (Tiger Nest) Hike', description: 'Guided morning ascent to Bhutan most iconic cliffside monastery.', meals: 'Breakfast, Dinner', stay: 'Zhiwa Ling Heritage, Paro' },
    ],
    hotelDetails: 'Taj Tashi Bhutan (Thimphu) · Zhiwa Ling Heritage (Paro)',
    vehicleDetails: 'Private Bhutan Luxury SUV + Licensed English-Speaking Guide',
    inclusions: '6 nights 5-star stays, MAP meals, private SUV, Bhutan permit & SDF handling.',
    exclusions: 'Drukair / Bhutan Airlines flights, travel insurance, monument entries.',
    price: 112000,
    childPrice: 74000,
    seasonalPrice: 135000,
    imageUrl: '/src/assets/images/package_kyoto_heritage_1795419417572.jpg',
    termsAndConditions: 'Valid Indian Passport or Voter ID with 6+ months validity mandatory for Bhutan entry.',
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
    preferences: 'Kanchenjunga view rooms, vegetarian meals, unhurried pace',
    specialRequests: 'Anniversary room floral decoration in Gangtok',
    internalRemarks: 'Repeat VIP couple. Always prefers Luxury category.',
    documents: [],
    totalBookings: 1,
    totalSpent: 75000,
    outstandingBalance: 45000,
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
    preferences: 'Heritage properties, early check-in when travelling with family',
    specialRequests: 'Toy train first-class seats in Darjeeling',
    internalRemarks: 'Referred by Malhotra family.',
    documents: [],
    totalBookings: 1,
    totalSpent: 84000,
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
    preferences: 'Boutique Himalayan luxury, cultural monasteries, guided treks',
    specialRequests: 'Hot stone bath experience at Zhiwa Ling Paro',
    internalRemarks: 'High intent for Bhutan winter itinerary.',
    documents: [],
    totalBookings: 1,
    totalSpent: 150000,
    outstandingBalance: 130000,
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
    destination: 'Gangtok & Pelling, Sikkim',
    startDate: '2026-12-05',
    endDate: '2026-12-10',
    adults: 2,
    children: 0,
    infants: 0,
    rooms: 1,
    hotelCategory: 'Luxury',
    budget: 130000,
    preferredVehicle: 'Crysta',
    specialRequirements: 'Mayfair Gangtok cottage + Tsomgo permit.',
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
    destination: 'Thimphu & Paro, Bhutan',
    startDate: '2026-12-18',
    endDate: '2026-12-24',
    adults: 2,
    children: 0,
    infants: 0,
    rooms: 1,
    hotelCategory: 'Luxury',
    budget: 300000,
    preferredVehicle: 'SUV',
    specialRequirements: 'Taj Tashi Thimphu + Zhiwa Ling Paro + Tiger Nest guide.',
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
    destination: 'Sikkim & Darjeeling Combo',
    startDate: '2027-01-12',
    endDate: '2027-01-19',
    adults: 4,
    children: 2,
    infants: 0,
    rooms: 2,
    hotelCategory: 'Premium',
    budget: 240000,
    preferredVehicle: 'Crysta',
    specialRequirements: 'Gangtok + Pelling + Darjeeling family combo with 2 connecting rooms.',
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
    destination: 'Darjeeling & Kalimpong',
    startDate: '2026-12-28',
    endDate: '2027-01-01',
    adults: 4,
    children: 1,
    infants: 0,
    rooms: 2,
    hotelCategory: 'Premium',
    budget: 165000,
    preferredVehicle: 'Innova',
    specialRequirements: 'New Year stay at Windamere Darjeeling + Kalimpong.',
    assignedToUid: uid,
    assignedToName: userName || 'Barnabas Sherpa',
    enquiryDate: todayStr,
    followUpDate: todayStr,
    status: 'New Enquiry',
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

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
    destination: 'Gangtok & Pelling, Sikkim',
    startDate: '2026-12-05',
    endDate: '2026-12-10',
    paxSummary: '2 Adults · 1 Room',
    hotelItems: [
      { hotelId: hotelRefs[0].ref.id, hotelName: 'Mayfair Spa Resort & Casino', region: 'Sikkim', city: 'Gangtok', roomType: 'Deluxe Cottage', mealPlan: 'MAP', nights: 3, rooms: 1, ratePerNight: 14500, total: 43500 },
      { hotelId: hotelRefs[1].ref.id, hotelName: 'The Chumbi Mountain Retreat & Spa', region: 'Sikkim', city: 'Pelling', roomType: 'Kanchenjunga View Suite', mealPlan: 'MAP', nights: 2, rooms: 1, ratePerNight: 7800, total: 15600 },
    ],
    transportItems: [
      { vehicleId: veh1Ref.id, vehicleCategory: 'Crysta', vehicleModel: 'Toyota Innova Crysta ZX (Hill Permit)', days: 6, ratePerDay: 4800, total: 28800 },
    ],
    sightseeingCharge: 11000,
    mealsCharge: 6500,
    otherExpenses: 4000,
    subtotal: 109400,
    markupPercent: 8,
    markupAmount: 8752,
    discountAmount: 3866,
    gstPercent: 5,
    gstAmount: 5714,
    totalCost: 120000,
    inclusions: '5 nights Sikkim luxury & premium stays, MAP meals, exclusive Innova Crysta, Tsomgo permits.',
    exclusions: 'Airfare to Bagdogra, Nathula Pass permit surcharge, personal expenses.',
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
    destination: 'Thimphu & Paro, Bhutan',
    startDate: '2026-12-18',
    endDate: '2026-12-24',
    paxSummary: '2 Adults · 1 Room',
    hotelItems: [
      { hotelId: hotelRefs[4].ref.id, hotelName: 'Taj Tashi Bhutan', region: 'Bhutan', city: 'Thimphu', roomType: 'Deluxe Room', mealPlan: 'MAP', nights: 3, rooms: 1, ratePerNight: 24000, total: 72000 },
      { hotelId: hotelRefs[5].ref.id, hotelName: 'Zhiwa Ling Heritage', region: 'Bhutan', city: 'Paro', roomType: 'Junior Suite', mealPlan: 'MAP', nights: 3, rooms: 1, ratePerNight: 22500, total: 67500 },
    ],
    transportItems: [
      { vehicleId: veh3Ref.id, vehicleCategory: 'SUV', vehicleModel: 'Toyota Prado / Land Cruiser Bhutan', days: 7, ratePerDay: 8500, total: 59500 },
    ],
    sightseeingCharge: 32000,
    mealsCharge: 12000,
    otherExpenses: 11000,
    subtotal: 254000,
    markupPercent: 8,
    markupAmount: 20320,
    discountAmount: 7653,
    gstPercent: 5,
    gstAmount: 13333,
    totalCost: 280000,
    inclusions: '6 nights 5* Bhutan heritage stays, MAP meals, private luxury SUV, licensed guide, permit & SDF processing.',
    exclusions: 'Drukair flights, travel insurance, personal shopping.',
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
    destination: 'Gangtok & Pelling, Sikkim',
    startDate: '2026-12-05',
    endDate: '2026-12-10',
    adults: 2,
    children: 0,
    infants: 0,
    packageId: pkg1Ref.id,
    packageName: 'Gangtok, Tsomgo & Pelling Himalayan Escape',
    hotelId: hotelRefs[0].ref.id,
    hotelName: 'Mayfair Spa Resort & Casino, The Chumbi Mountain Retreat & Spa',
    selectedHotels: [
      { hotelId: hotelRefs[0].ref.id, hotelName: 'Mayfair Spa Resort & Casino', region: 'Sikkim', city: 'Gangtok' },
      { hotelId: hotelRefs[1].ref.id, hotelName: 'The Chumbi Mountain Retreat & Spa', region: 'Sikkim', city: 'Pelling' },
    ],
    vehicleId: veh1Ref.id,
    vehicleDetails: 'Toyota Innova Crysta ZX (SK-01-J-4821)',
    bookingAmount: 120000,
    advanceReceived: 75000,
    remainingAmount: 45000,
    paymentStatus: 'Partial',
    bookingStatus: 'Confirmed',
    operationsManagerUid: uid,
    operationsManagerName: userName || 'Barnabas Sherpa',
    assignedToUid: uid,
    specialNotes: 'Anniversary cottage upgrade requested in Gangtok.',
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
    destination: 'Darjeeling & Kalimpong',
    startDate: '2026-11-20',
    endDate: '2026-11-24',
    adults: 2,
    children: 1,
    infants: 0,
    packageId: pkg2Ref.id,
    packageName: 'Darjeeling Queen of Hills & Kalimpong Retreat',
    hotelId: hotelRefs[2].ref.id,
    hotelName: 'Windamere Hotel Heritage, Mayfair Himalayan Spa Resort',
    selectedHotels: [
      { hotelId: hotelRefs[2].ref.id, hotelName: 'Windamere Hotel Heritage', region: 'Darjeeling', city: 'Darjeeling' },
      { hotelId: hotelRefs[3].ref.id, hotelName: 'Mayfair Himalayan Spa Resort', region: 'Darjeeling', city: 'Kalimpong' },
    ],
    vehicleId: veh2Ref.id,
    vehicleDetails: 'Mahindra Xylo / Scorpio Hill Edition (WB-73-T-9012)',
    bookingAmount: 84000,
    advanceReceived: 84000,
    remainingAmount: 0,
    paymentStatus: 'Paid',
    bookingStatus: 'In Progress',
    operationsManagerUid: uid,
    operationsManagerName: userName || 'Barnabas Sherpa',
    assignedToUid: uid,
    specialNotes: 'Toy train seats confirmed for Day 2 morning.',
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
    destination: 'Thimphu & Paro, Bhutan',
    startDate: '2026-12-18',
    endDate: '2026-12-24',
    adults: 2,
    children: 0,
    infants: 0,
    packageId: pkg3Ref.id,
    packageName: 'Kingdom of Happiness: Thimphu, Punakha & Paro',
    hotelId: hotelRefs[4].ref.id,
    hotelName: 'Taj Tashi Bhutan, Zhiwa Ling Heritage',
    selectedHotels: [
      { hotelId: hotelRefs[4].ref.id, hotelName: 'Taj Tashi Bhutan', region: 'Bhutan', city: 'Thimphu' },
      { hotelId: hotelRefs[5].ref.id, hotelName: 'Zhiwa Ling Heritage', region: 'Bhutan', city: 'Paro' },
    ],
    vehicleId: veh3Ref.id,
    vehicleDetails: 'Toyota Prado / Land Cruiser Bhutan (BP-1-A-1109)',
    bookingAmount: 280000,
    advanceReceived: 150000,
    remainingAmount: 130000,
    paymentStatus: 'Partial',
    bookingStatus: 'Confirmed',
    operationsManagerUid: uid,
    operationsManagerName: userName || 'Barnabas Sherpa',
    assignedToUid: uid,
    specialNotes: 'Bhutan SDF permit documents verified and submitted.',
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  // 12. Expenses
  const exp1Ref = doc(collection(db, 'expenses'));
  const exp2Ref = doc(collection(db, 'expenses'));

  batch.set(exp1Ref, {
    expenseCode: 'EXP-2026-001',
    category: 'Hotel Payment',
    vendorName: 'Mayfair Spa Resort & Casino Gangtok',
    bookingCode: 'BK-2026-001',
    amount: 43500,
    paidAmount: 25000,
    pendingAmount: 18500,
    mode: 'Bank Transfer',
    status: 'Partial',
    dueDate: '2026-11-28',
    notes: 'Advance deposit paid for Gangtok 3-night cottage block.',
    recordedByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(exp2Ref, {
    expenseCode: 'EXP-2026-002',
    category: 'Transport Payment',
    vendorName: 'Siliguri Darjeeling Cab Union',
    bookingCode: 'BK-2026-002',
    amount: 18500,
    paidAmount: 18500,
    pendingAmount: 0,
    mode: 'UPI',
    status: 'Paid',
    dueDate: '2026-11-19',
    notes: 'Settled for Darjeeling & Kalimpong tour.',
    recordedByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  // 13. Follow-ups
  const fu1Ref = doc(collection(db, 'followups'));
  const fu2Ref = doc(collection(db, 'followups'));
  const fu3Ref = doc(collection(db, 'followups'));

  batch.set(fu1Ref, {
    title: 'Follow up with Neha Kapoor on Sikkim & Darjeeling Combo Quote',
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
    notes: 'Confirm connecting family room availability in Gangtok & Darjeeling.',
    history: [],
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(fu2Ref, {
    title: 'Collect balance ₹45,000 for Sikkim Gangtok-Pelling Booking',
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
    notes: 'Share UPI / NEFT details along with Tsomgo Lake permit confirmation.',
    history: [],
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(fu3Ref, {
    title: 'Call Vikramaditya Joshi regarding Darjeeling & Kalimpong Dates',
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
    notes: 'Verify Windamere Heritage room block for New Year week.',
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
    message: 'Vikramaditya Joshi requested a Darjeeling & Kalimpong quote for 5 guests.',
    category: 'Enquiry',
    targetUid: 'all',
    isRead: false,
    linkModule: 'enquiries',
    createdByUid: uid,
    createdAt: now,
  });
  batch.set(not2Ref, {
    title: 'Upcoming Departure: Darjeeling & Kalimpong',
    message: 'BK-2026-002 (Rohan Deshmukh) is currently In Progress with Windamere Hotel Heritage.',
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
    content: 'Spoke with Aarav. Confirmed 3 nights at Mayfair Gangtok and 2 nights at Chumbi Mountain Retreat Pelling.',
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
    amount: 75000,
    gstComponent: 3571,
    mode: 'Bank Transfer',
    referenceNumber: 'NEFT-884920112',
    paymentDate: '2026-11-12',
    notes: 'Booking advance deposit received for Sikkim tour.',
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
    amount: 84000,
    gstComponent: 4000,
    mode: 'UPI',
    referenceNumber: 'UPI-6642091827',
    paymentDate: '2026-11-08',
    notes: 'Full settlement received prior to Darjeeling & Kalimpong departure.',
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
    notes: 'Initial token deposit for Taj Tashi & Zhiwa Ling Bhutan block.',
    recordedByUid: uid,
    createdAt: now,
  });

  if (existingInvoicesSnap.empty) {
    const inv1Ref = doc(collection(db, 'invoices'));
    batch2.set(inv1Ref, {
      invoiceCode: 'INV-2026-001',
      invoiceType: 'Tax Invoice',
      bookingId: bk1Ref.id,
      bookingCode: 'BK-2026-001',
      customerId: cust1Ref.id,
      customerName: 'Aarav & Priya Malhotra',
      customerPhone: '+91 98201 33412',
      customerEmail: 'aarav.malhotra@example.com',
      customerAddress: 'Mumbai, Maharashtra',
      destination: 'Gangtok & Pelling, Sikkim',
      travelDates: '15 Dec 2026 – 20 Dec 2026',
      issueDate: '2026-11-12',
      dueDate: '2026-12-01',
      items: [
        {
          description: 'Sikkim Himalayan Serenity — Gangtok & Pelling Tour Package (2 Adults)',
          hsnSac: '998551',
          quantity: 1,
          unitPrice: 114286,
          amount: 114286,
        },
      ],
      subtotal: 114286,
      discountAmount: 0,
      gstPercent: 5,
      gstAmount: 5714,
      totalAmount: 120000,
      paidAmount: 75000,
      balanceDue: 45000,
      status: 'Partial',
      notes: 'Advance deposit of ₹75,000 received via NEFT. Balance payable prior to departure.',
      termsAndConditions:
        '1. Carry original Voter ID / Passport (mandatory for Sikkim Protected Area Permits & Bhutan immigration).\n2. Standard check-in 14:00 hrs and check-out 11:00 hrs unless specified.',
      createdByUid: uid,
      createdAt: now,
      updatedAt: now,
    });
  }

  await batch2.commit();
}
