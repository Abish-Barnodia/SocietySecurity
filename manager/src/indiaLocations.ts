// ponytail: Standard clean list of all 28 Indian States & 8 Union Territories with major cities
// Native <datalist> uses these for instant filtering and autocomplete with zero dependencies.

export const INDIAN_STATES: string[] = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  // Union Territories
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

export const CITIES_BY_STATE: Record<string, string[]> = {
  'Andhra Pradesh': [
    'Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Rajahmundry',
    'Tirupati', 'Kakinada', 'Kadapa', 'Anantapur', 'Vizianagaram', 'Eluru',
    'Ongole', 'Nandyal', 'Machilipatnam', 'Adoni', 'Tenali', 'Proddatur', 'Chittoor', 'Hindupur'
  ],
  'Arunachal Pradesh': [
    'Itanagar', 'Naharlagun', 'Pasighat', 'Tawang', 'Ziro', 'Bomdila', 'Tezu', 'Along'
  ],
  'Assam': [
    'Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tinsukia', 'Tezpur',
    'Bongaigaon', 'Karimganj', 'Sivasagar', 'Goalpara', 'Barpeta', 'Dhubri', 'Diphu', 'North Lakhimpur'
  ],
  'Bihar': [
    'Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia', 'Darbhanga', 'Bihar Sharif',
    'Arrah', 'Begusarai', 'Katihar', 'Munger', 'Chhapra', 'Bettiah', 'Saharsa',
    'Sasaram', 'Hajipur', 'Dehri', 'Siwan', 'Motihari', 'Nawada', 'Bagaha', 'Buxar', 'Kishanganj', 'Sitamarhi'
  ],
  'Chhattisgarh': [
    'Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Rajnandgaon', 'Durg', 'Jagdalpur',
    'Ambikapur', 'Raigarh', 'Dhamtari', 'Mahasamund', 'Kanker', 'Kawardha', 'Champa'
  ],
  'Goa': [
    'Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda', 'Bicholim', 'Curchorem', 'Cuncolim', 'Canacona'
  ],
  'Gujarat': [
    'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Junagadh',
    'Gandhinagar', 'Anand', 'Navsari', 'Morbi', 'Nadiad', 'Surendranagar', 'Bharuch',
    'Mehsana', 'Bhuj', 'Porbandar', 'Vapi', 'Valsad', 'Veraval', 'Godhra', 'Patan',
    'Dahod', 'Botad', 'Amreli', 'Deesa', 'Jetpur', 'Palanpur', 'Anjar'
  ],
  'Haryana': [
    'Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Yamunanagar', 'Rohtak', 'Hisar',
    'Karnal', 'Sonipat', 'Panchkula', 'Bahadurgarh', 'Jind', 'Sirsa', 'Thanesar',
    'Kaithal', 'Rewari', 'Palwal', 'Hansi', 'Narnaul', 'Fatehabad', 'Tohana'
  ],
  'Himachal Pradesh': [
    'Shimla', 'Dharamshala', 'Solan', 'Mandi', 'Kullu', 'Baddi', 'Bilaspur',
    'Hamirpur', 'Una', 'Chamba', 'Manali', 'Nahan', 'Paonta Sahib', 'Sundarnagar'
  ],
  'Jharkhand': [
    'Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro Steel City', 'Deoghar', 'Phusro',
    'Hazaribagh', 'Giridih', 'Ramgarh', 'Medininagar', 'Chirkunda', 'Chaibasa', 'Dumka', 'Gumia', 'Sahibganj'
  ],
  'Karnataka': [
    'Bengaluru', 'Mysuru', 'Hubballi-Dharwad', 'Mangaluru', 'Belagavi', 'Davanagere',
    'Ballari', 'Vijayapura', 'Shivamogga', 'Tumakuru', 'Raichur', 'Bidar',
    'Hosapete', 'Udupi', 'Hassan', 'Gadag-Betageri', 'Robertsonpet', 'Bhadravati',
    'Chitradurga', 'Kolar', 'Mandya', 'Chikkamagaluru', 'Gangavathi', 'Bagalkot', 'Ranebennuru'
  ],
  'Kerala': [
    'Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Kollam', 'Thrissur', 'Kannur',
    'Alappuzha', 'Kottayam', 'Palakkad', 'Manjeri', 'Thalassery', 'Ponnani',
    'Vatakara', 'Malappuram', 'Kanhangad', 'Payyanur', 'Koyilandy', 'Neyyattinkara', 'Kayamkulam'
  ],
  'Madhya Pradesh': [
    'Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Dewas', 'Satna',
    'Ratlam', 'Rewa', 'Katni', 'Singrauli', 'Burhanpur', 'Khandwa', 'Morena',
    'Bhind', 'Chhindwara', 'Guna', 'Shivpuri', 'Vidisha', 'Damoh', 'Mandsaur', 'Khargone', 'Neemuch', 'Pithampur'
  ],
  'Maharashtra': [
    'Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Kalyan-Dombivli', 'Vasai-Virar',
    'Chhatrapati Sambhaji Nagar', 'Navi Mumbai', 'Solapur', 'Mira-Bhayandar',
    'Bhiwandi-Nizampur', 'Amravati', 'Nanded', 'Kolhapur', 'Akola', 'Ulhasnagar',
    'Sangli-Miraj', 'Malegaon', 'Jalgaon', 'Latur', 'Dhule', 'Ahmednagar',
    'Chandrapur', 'Parbhani', 'Jalna', 'Panvel', 'Satara', 'Beed', 'Yavatmal',
    'Gondia', 'Wardha', 'Baramati', 'Ichalkaranji', 'Achalpur', 'Osmanabad', 'Nandurbar'
  ],
  'Manipur': [
    'Imphal', 'Churachandpur', 'Thoubal', 'Kakching', 'Ukhrul', 'Senapati', 'Bishnupur'
  ],
  'Meghalaya': [
    'Shillong', 'Tura', 'Jowai', 'Nongpoh', 'Baghmara', 'Williamnagar', 'Mairang'
  ],
  'Mizoram': [
    'Aizawl', 'Lunglei', 'Champhai', 'Serchhip', 'Kolasib', 'Lawngtlai', 'Saitual'
  ],
  'Nagaland': [
    'Kohima', 'Dimapur', 'Mokokchung', 'Tuensang', 'Wokha', 'Zunheboto', 'Mon'
  ],
  'Odisha': [
    'Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri',
    'Balasore', 'Bhadrak', 'Baripada', 'Jharsuguda', 'Jeypore', 'Bargarh',
    'Rayagada', 'Bolangir', 'Angul', 'Dhenkanal', 'Kendrapara'
  ],
  'Punjab': [
    'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali (SAS Nagar)',
    'Hoshiarpur', 'Batala', 'Pathankot', 'Moga', 'Abohar', 'Malerkotla', 'Khanna',
    'Phagwara', 'Muktsar', 'Barnala', 'Firozpur', 'Kapurthala', 'Rajpura', 'Sangrur', 'Fazilka'
  ],
  'Rajasthan': [
    'Jaipur', 'Jodhpur', 'Kota', 'Bikaner', 'Ajmer', 'Udaipur', 'Bhilwara',
    'Alwar', 'Bharatpur', 'Sikar', 'Pali', 'Sri Ganganagar', 'Kishangarh',
    'Baran', 'Dholpur', 'Tonk', 'Beawar', 'Hanumangarh', 'Sawai Madhopur', 'Churu', 'Gangapur City', 'Jhunjhunu', 'Bhiwadi'
  ],
  'Sikkim': [
    'Gangtok', 'Namchi', 'Geyzing', 'Mangan', 'Rangpo', 'Jorethang', 'Singtam'
  ],
  'Tamil Nadu': [
    'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tiruppur',
    'Erode', 'Tirunelveli', 'Vellore', 'Thoothukudi', 'Dindigul', 'Thanjavur',
    'Ranipet', 'Sivakasi', 'Karur', 'Udhagamandalam (Ooty)', 'Hosur', 'Nagercoil',
    'Kanchipuram', 'Kumbakonam', 'Cuddalore', 'Tiruvannamalai', 'Pollachi', 'Rajapalayam', 'Pudukkottai', 'Ambur'
  ],
  'Telangana': [
    'Hyderabad', 'Warangal', 'Nizamabad', 'Khammam', 'Karimnagar', 'Ramagundam',
    'Mahbubnagar', 'Nalgonda', 'Adilabad', 'Suryapet', 'Miryalaguda', 'Siddipet',
    'Jagtial', 'Mancherial', 'Kothagudem', 'Bodhan', 'Palwancha', 'Kamareddy'
  ],
  'Tripura': [
    'Agartala', 'Dharmanagar', 'Udaipur', 'Kailashahar', 'Belonia', 'Khowai', 'Teliamura'
  ],
  'Uttar Pradesh': [
    'Lucknow', 'Kanpur', 'Ghaziabad', 'Agra', 'Varanasi', 'Meerut', 'Prayagraj (Allahabad)',
    'Bareilly', 'Aligarh', 'Moradabad', 'Saharanpur', 'Gorakhpur', 'Noida',
    'Greater Noida', 'Firozabad', 'Jhansi', 'Muzaffarnagar', 'Mathura', 'Ayodhya',
    'Rampur', 'Shahjahanpur', 'Farrukhabad', 'Mau', 'Hapur', 'Etawah', 'Mirzapur',
    'Bulandshahr', 'Sambhal', 'Amroha', 'Hardoi', 'Fatehpur', 'Raebareli', 'Orai',
    'Sitapur', 'Bahraich', 'Modinagar', 'Unnao', 'Jaunpur', 'Lakhimpur', 'Hathras', 'Banda', 'Pilibhit', 'Barabanki'
  ],
  'Uttarakhand': [
    'Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rudrapur', 'Kashipur',
    'Rishikesh', 'Nainital', 'Mussoorie', 'Pithoragarh', 'Almora', 'Kotdwar', 'Ramnagar'
  ],
  'West Bengal': [
    'Kolkata', 'Howrah', 'Asansol', 'Siliguri', 'Durgapur', 'Bardhaman', 'Malda',
    'Baharampur', 'Habra', 'Kharagpur', 'Shantipur', 'Dankuni', 'Dhulian',
    'Ranaghat', 'Haldia', 'Raiganj', 'Krishnanagar', 'Nabadwip', 'Midnapore',
    'Balurghat', 'Basirhat', 'Bankura', 'Darjeeling', 'Alipurduar', 'Purulia', 'Jalpaiguri'
  ],
  'Andaman and Nicobar Islands': [
    'Port Blair', 'Diglipur', 'Garacharma', 'Bambooflat'
  ],
  'Chandigarh': [
    'Chandigarh'
  ],
  'Dadra and Nagar Haveli and Daman and Diu': [
    'Daman', 'Diu', 'Silvassa'
  ],
  'Delhi': [
    'New Delhi', 'Central Delhi', 'North Delhi', 'South Delhi', 'East Delhi',
    'West Delhi', 'North West Delhi', 'South West Delhi', 'Dwarka', 'Rohini',
    'Saket', 'Connaught Place', 'Vasant Kunj', 'Karol Bagh', 'Laxmi Nagar', 'Janakpuri', 'Pitampura', 'Narela'
  ],
  'Jammu and Kashmir': [
    'Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Kathua', 'Udhampur', 'Sopore', 'Rajouri', 'Poonch'
  ],
  'Ladakh': [
    'Leh', 'Kargil'
  ],
  'Lakshadweep': [
    'Kavaratti', 'Agatti', 'Amini', 'Andrott'
  ],
  'Puducherry': [
    'Puducherry', 'Karaikal', 'Mahe', 'Yanam'
  ],
};

// Flattened popular cities list across India (used when no state selected yet)
export const ALL_INDIAN_CITIES: string[] = Array.from(
  new Set(Object.values(CITIES_BY_STATE).flat())
).sort((a, b) => a.localeCompare(b));

// Helper: Get cities list for selected state, or all cities if none selected
export function getCitiesForState(stateName: string): string[] {
  if (!stateName) return ALL_INDIAN_CITIES;
  const match = Object.keys(CITIES_BY_STATE).find(
    s => s.toLowerCase() === stateName.trim().toLowerCase()
  );
  return match ? CITIES_BY_STATE[match] : ALL_INDIAN_CITIES;
}

// Helper: Auto-find state for a typed city if state is empty
export function findStateForCity(cityName: string): string | undefined {
  if (!cityName) return undefined;
  const normalized = cityName.trim().toLowerCase();
  for (const [state, cities] of Object.entries(CITIES_BY_STATE)) {
    if (cities.some(c => c.toLowerCase() === normalized)) {
      return state;
    }
  }
  return undefined;
}
