import React, { useState } from 'react';
import {
  Search,
  Utensils,
  MapPin,
  Star,
  ListOrdered,
  Flame,
  Globe2,
  Briefcase,
  Tag,
} from 'lucide-react';
import { SearchFilters } from '../types';

interface SearchFormProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  onSearch: () => void;
  isLoading: boolean;
}

export interface RegionState {
  code: string;
  name: string;
  territory?: boolean;
}

const SORTED_INDUSTRIES: string[] = [
  'Accountants',
  'Architecture & Interior Design',
  'Auto Repair & Dealerships',
  'Beauty & Spas',
  'Chiropractors & Physical Therapy',
  'Cleaning Companies',
  'Construction Companies',
  'Consulting Firms',
  'Contractors & Handymen',
  'Dentists',
  'Ecommerce Businesses',
  'Electricians',
  'Event Planners & Venues',
  'Financial Advisors & Insurance',
  'Fitness Studios & Gyms',
  'Home Services & Landscaping',
  'Hotels',
  'HVAC Contractors',
  'Lawyers',
  'Marketing Agencies',
  'Medical Clinics & Med Spas',
  'Moving & Storage Companies',
  'Pet Care & Veterinarians',
  'Photography & Videography',
  'Plumbers',
  'Real Estate Agents',
  'Restaurants',
  'Roofing Companies',
  'Salons',
  'SEO Agencies',
  'Software Companies',
  'Solar & Energy Installers',
  'Travel & Hospitality',
  'Web Designers',
].sort((a, b) => a.localeCompare(b));

export const BUSINESS_INDUSTRIES: string[] = [...SORTED_INDUSTRIES, 'Other'];

export const INDUSTRY_SPECIALTIES: Record<string, string[]> = {
  Accountants: [
    'CPA Firms',
    'Small Business Bookkeeping',
    'Tax Preparation',
    'Payroll Services',
    'Forensic Accounting',
    'Fractional CFO',
  ],
  'Architecture & Interior Design': [
    'Residential Architects',
    'Commercial Architecture',
    'Interior Designers',
    'Kitchen & Bath Design',
    'Landscape Architecture',
  ],
  'Auto Repair & Dealerships': [
    'Auto Repair Shops',
    'Auto Body & Collision',
    'Car Dealerships',
    'Auto Detailing',
    'Tire & Brake Shops',
    'Transmission Repair',
  ],
  'Beauty & Spas': [
    'Day Spas',
    'Massage Therapy',
    'Estheticians & Facials',
    'Waxing & Laser Hair Removal',
    'Nail & Spa Studios',
  ],
  'Chiropractors & Physical Therapy': [
    'Chiropractors',
    'Physical Therapy Clinics',
    'Sports Rehab',
    'Acupuncture Clinics',
    'Pain Management',
  ],
  'Cleaning Companies': [
    'Residential House Cleaning',
    'Commercial Janitorial',
    'Move-Out & Deep Cleaning',
    'Carpet & Upholstery',
    'Window Cleaning',
    'Post-Construction Cleaning',
  ],
  'Construction Companies': [
    'General Contractors',
    'Home Remodeling',
    'Commercial Construction',
    'Custom Home Builders',
    'Concrete & Excavation',
  ],
  'Consulting Firms': [
    'Management Consulting',
    'HR & Recruiting',
    'Operations Consulting',
    'IT Consulting',
    'Business Coaching',
  ],
  'Contractors & Handymen': [
    'Handyman Services',
    'Home Renovation',
    'Deck & Fence Builders',
    'Flooring Installers',
    'Painting Contractors',
  ],
  Dentists: [
    'Family Dentistry',
    'Cosmetic Dentistry',
    'Pediatric Dentist',
    'Orthodontist',
    'Emergency Dental',
    'Dental Implants',
  ],
  'Ecommerce Businesses': [
    'Ecommerce Fulfillment',
    'Shopify Brands',
    'Online Retail Stores',
    'Direct to Consumer Brands',
    'Wholesale Distributors',
    'Subscription Boxes',
  ],
  Electricians: [
    'Residential Electricians',
    'Commercial Electrical',
    'EV Charger Installation',
    'Emergency Electrician',
    'Panel Upgrades',
  ],
  'Event Planners & Venues': [
    'Wedding Venues',
    'Event Planning Agencies',
    'Catering Companies',
    'Party & Tent Rentals',
    'Corporate Event Production',
  ],
  'Financial Advisors & Insurance': [
    'Wealth Management',
    'Independent Insurance Agencies',
    'Mortgage Brokers',
    'Retirement Planning',
    'Commercial Insurance',
  ],
  'Fitness Studios & Gyms': [
    'Personal Training Studios',
    'Pilates & Yoga Studios',
    'CrossFit & Functional Gyms',
    'Martial Arts Academies',
    'Boxing & Cycling Studios',
  ],
  'Home Services & Landscaping': [
    'Landscaping & Lawn Care',
    'Tree Services',
    'Pest Control',
    'Pool Cleaning & Repair',
    'Garage Door Repair',
  ],
  Hotels: [
    'Boutique Hotels',
    'Luxury Resorts',
    'Bed & Breakfast',
    'Extended Stay',
    'Business Hotels',
    'Historic Inns',
  ],
  'HVAC Contractors': [
    'AC Repair & Installation',
    'Heating & Furnace Repair',
    'Commercial HVAC',
    'Duct Cleaning',
    'Heat Pump Installation',
  ],
  Lawyers: [
    'Personal Injury',
    'Family & Divorce Law',
    'Immigration Law',
    'Criminal Defense',
    'Business & Corporate Law',
    'Estate Planning',
  ],
  'Marketing Agencies': [
    'Digital Marketing',
    'Social Media Marketing',
    'PPC & Paid Ads',
    'Branding & Creative',
    'PR & Communications',
    'Lead Generation',
  ],
  'Medical Clinics & Med Spas': [
    'Med Spas & Aesthetics',
    'Urgent Care Clinics',
    'Dermatology Clinics',
    'Optometrists & Eye Care',
    'Wellness & IV Therapy',
  ],
  'Moving & Storage Companies': [
    'Local Residential Movers',
    'Long Distance Moving',
    'Commercial Office Movers',
    'Junk Removal',
    'Self Storage Facilities',
  ],
  'Pet Care & Veterinarians': [
    'Veterinary Clinics',
    'Dog Grooming',
    'Pet Boarding & Daycare',
    'Dog Training',
    'Emergency Vet Hospitals',
  ],
  'Photography & Videography': [
    'Wedding Photographers',
    'Commercial Video Production',
    'Real Estate Photography',
    'Portrait Studios',
    'Brand Content Studios',
  ],
  Plumbers: [
    'Emergency Plumbers',
    'Drain & Sewer Cleaning',
    'Water Heater Repair',
    'Commercial Plumbing',
    'Repiping & Leak Detection',
  ],
  'Real Estate Agents': [
    'Residential Real Estate',
    'Luxury Homes',
    'Commercial Real Estate',
    'Property Management',
    'First-Time Home Buyers',
    'Real Estate Brokerages',
  ],
  'Roofing Companies': [
    'Residential Roof Repair',
    'Commercial Roofing',
    'Storm Damage Restoration',
    'Metal Roofing',
    'Gutter Installation',
  ],
  Salons: [
    'Hair Salon',
    'Nail Salon',
    'Barbershop',
    'Med Spa & Aesthetics',
    'Balayage & Color Studio',
    'Lash & Brow Studio',
  ],
  'SEO Agencies': [
    'Local SEO',
    'Technical SEO',
    'Link Building',
    'Ecommerce SEO',
    'Enterprise SEO',
    'Content Marketing',
  ],
  'Software Companies': [
    'SaaS Companies',
    'Custom Software Development',
    'Mobile App Developers',
    'IT & Managed Services',
    'Cybersecurity Firms',
    'Cloud Consulting',
  ],
  'Solar & Energy Installers': [
    'Residential Solar Panels',
    'Commercial Solar',
    'Solar Battery Storage',
    'Energy Audits',
  ],
  'Travel & Hospitality': [
    'Tour Operators',
    'Vacation Rentals',
    'Travel Agencies',
    'Charter & Boat Rentals',
  ],
  'Web Designers': [
    'WordPress Design',
    'Shopify & Ecommerce',
    'Custom Web Development',
    'UI/UX Design',
    'Small Business Websites',
    'Webflow Agency',
  ],
  Other: [
    'Coffee Shops',
    'Dry Cleaners',
    'Florists',
    'Locksmiths',
    'Tattoo Studios',
    'Tutoring Centers',
    'Bridal Boutiques',
    'Daycare Centers',
    'Printing & Sign Shops',
    'Funeral Homes',
  ],
};

export const US_REGIONS: { category: string; states: RegionState[] }[] = [
  {
    category: 'U.S. States & Federal District',
    states: [
      { code: 'AL', name: 'Alabama' },
      { code: 'AK', name: 'Alaska' },
      { code: 'AZ', name: 'Arizona' },
      { code: 'AR', name: 'Arkansas' },
      { code: 'CA', name: 'California' },
      { code: 'CO', name: 'Colorado' },
      { code: 'CT', name: 'Connecticut' },
      { code: 'DE', name: 'Delaware' },
      { code: 'DC', name: 'District of Columbia' },
      { code: 'FL', name: 'Florida' },
      { code: 'GA', name: 'Georgia' },
      { code: 'HI', name: 'Hawaii' },
      { code: 'ID', name: 'Idaho' },
      { code: 'IL', name: 'Illinois' },
      { code: 'IN', name: 'Indiana' },
      { code: 'IA', name: 'Iowa' },
      { code: 'KS', name: 'Kansas' },
      { code: 'KY', name: 'Kentucky' },
      { code: 'LA', name: 'Louisiana' },
      { code: 'ME', name: 'Maine' },
      { code: 'MD', name: 'Maryland' },
      { code: 'MA', name: 'Massachusetts' },
      { code: 'MI', name: 'Michigan' },
      { code: 'MN', name: 'Minnesota' },
      { code: 'MS', name: 'Mississippi' },
      { code: 'MO', name: 'Missouri' },
      { code: 'MT', name: 'Montana' },
      { code: 'NE', name: 'Nebraska' },
      { code: 'NV', name: 'Nevada' },
      { code: 'NH', name: 'New Hampshire' },
      { code: 'NJ', name: 'New Jersey' },
      { code: 'NM', name: 'New Mexico' },
      { code: 'NY', name: 'New York' },
      { code: 'NC', name: 'North Carolina' },
      { code: 'ND', name: 'North Dakota' },
      { code: 'OH', name: 'Ohio' },
      { code: 'OK', name: 'Oklahoma' },
      { code: 'OR', name: 'Oregon' },
      { code: 'PA', name: 'Pennsylvania' },
      { code: 'RI', name: 'Rhode Island' },
      { code: 'SC', name: 'South Carolina' },
      { code: 'SD', name: 'South Dakota' },
      { code: 'TN', name: 'Tennessee' },
      { code: 'TX', name: 'Texas' },
      { code: 'UT', name: 'Utah' },
      { code: 'VT', name: 'Vermont' },
      { code: 'VA', name: 'Virginia' },
      { code: 'WA', name: 'Washington' },
      { code: 'WV', name: 'West Virginia' },
      { code: 'WI', name: 'Wisconsin' },
      { code: 'WY', name: 'Wyoming' },
    ],
  },
  {
    category: 'U.S. Territories',
    states: [
      { code: 'PR', name: 'Puerto Rico', territory: true },
      { code: 'VI', name: 'U.S. Virgin Islands', territory: true },
      { code: 'GU', name: 'Guam', territory: true },
      { code: 'MP', name: 'Northern Mariana Islands', territory: true },
      { code: 'AS', name: 'American Samoa', territory: true },
    ],
  },
];

export const FAMOUS_DISH_CATEGORIES: {
  category: string;
  dishes: { name: string; query: string; icon?: string }[];
}[] = [
  {
    category: 'Famous Signature Dishes',
    dishes: [
      { name: 'Smoked Brisket', query: 'Smoked Brisket BBQ' },
      { name: 'Hot Chicken', query: 'Hot Chicken' },
      { name: 'Deep Dish Pizza', query: 'Deep Dish Pizza' },
      { name: 'Thin Crust Pizza', query: 'Thin Crust Pizza' },
      { name: 'Lobster Rolls', query: 'Lobster Roll Clam Chowder' },
      { name: 'Cheesesteaks', query: 'Cheesesteak' },
      { name: 'Seafood Gumbo', query: 'Cajun Creole Gumbo Crawfish' },
      { name: 'Birria Tacos', query: 'Birria Tacos' },
      { name: 'Pulled Pork BBQ', query: 'Pulled Pork BBQ' },
      { name: 'Burnt Ends BBQ', query: 'BBQ Burnt Ends' },
      { name: 'Crab Cakes', query: 'Crab Cakes' },
      { name: 'Ahi Poke Bowls', query: 'Poke Bowls' },
      { name: 'Pan Pizza', query: 'Pan Pizza Square Pizza' },
      { name: 'Fried Chicken & Waffles', query: 'Chicken and Waffles' },
      { name: 'Buffalo Wings', query: 'Buffalo Wings' },
      { name: 'Cioppino Seafood Stew', query: 'Cioppino Seafood' },
    ],
  },
  {
    category: 'BBQ & Steakhouses',
    dishes: [
      { name: 'All BBQ', query: 'Barbecue BBQ' },
      { name: 'Smoked Beef Ribs', query: 'Smoked Beef Ribs' },
      { name: 'Prime Ribeye Steakhouse', query: 'Prime Ribeye Steakhouse' },
      { name: 'Korean BBQ', query: 'Korean BBQ Galbi Pork Belly' },
      { name: 'Brazilian Churrascaria', query: 'Brazilian Steakhouse Churrascaria' },
    ],
  },
  {
    category: 'Tacos, Mexican & Latin',
    dishes: [
      { name: 'Street Tacos & Carnitas', query: 'Street Tacos Carnitas' },
      { name: 'Tex-Mex Sizzling Fajitas', query: 'Tex-Mex Fajitas Queso' },
      { name: 'Peruvian Ceviche & Pollo', query: 'Peruvian Ceviche Pollo a la Brasa' },
      { name: 'Cuban Sandwiches', query: 'Cuban Restaurant Sandwich' },
    ],
  },
  {
    category: 'Asian Specialties',
    dishes: [
      { name: 'Tonkotsu Ramen', query: 'Tonkotsu Ramen Noodles' },
      { name: 'Edomae Sushi & Omakase', query: 'Sushi Omakase Japanese' },
      { name: 'Dim Sum & Roast Duck', query: 'Dim Sum Cantonese Roast Duck' },
      { name: 'Vietnamese Pho & Banh Mi', query: 'Vietnamese Pho Banh Mi' },
      { name: 'Thai Tom Yum & Curry', query: 'Thai Food Curry Pad Thai' },
      { name: 'Indian Biryani & Tikka', query: 'Indian Biryani Tikka Masala' },
    ],
  },
  {
    category: 'Italian & European',
    dishes: [
      { name: 'Wood-Fired Neapolitan Pizza', query: 'Neapolitan Wood Fired Pizza' },
      { name: 'Handmade Pasta & Trattoria', query: 'Handmade Pasta Italian Trattoria' },
      { name: 'French Bistro & Steak Frites', query: 'French Bistro Steak Frites' },
      { name: 'Mediterranean Shawarma & Meze', query: 'Mediterranean Shawarma Kebab' },
    ],
  },
  {
    category: 'Burgers, Deli & Casual',
    dishes: [
      { name: 'Smash Burgers & Shakes', query: 'Smash Burgers Craft Shakes' },
      { name: 'Smoked Pastrami Deli', query: 'Pastrami Deli' },
      { name: 'Craft Beer & Gastropub', query: 'Gastropub Craft Beer' },
      { name: 'Farm-to-Table American', query: 'Farm to Table Seasonal' },
      { name: 'Artisan Bakery & Cafe', query: 'Bakery Cafe Pastries' },
    ],
  },
];

export const POPULAR_CITY_HUBS = [
  { city: 'Austin', state: 'Texas', label: 'Austin, TX' },
  { city: 'New Orleans', state: 'Louisiana', label: 'New Orleans, LA' },
  { city: 'New York', state: 'New York', label: 'New York, NY' },
  { city: 'Chicago', state: 'Illinois', label: 'Chicago, IL' },
  { city: 'Miami', state: 'Florida', label: 'Miami, FL' },
  { city: 'Nashville', state: 'Tennessee', label: 'Nashville, TN' },
  { city: 'San Francisco', state: 'California', label: 'San Francisco, CA' },
  { city: 'Los Angeles', state: 'California', label: 'Los Angeles, CA' },
  { city: 'Houston', state: 'Texas', label: 'Houston, TX' },
  { city: 'San Juan', state: 'Puerto Rico', label: 'San Juan, PR' },
  { city: 'Honolulu', state: 'Hawaii', label: 'Honolulu, HI' },
  { city: 'Philadelphia', state: 'Pennsylvania', label: 'Philadelphia, PA' },
];

export function buildPlaceSearchQuery(filters: SearchFilters): string {
  const rawIndustry = filters.industry || 'Restaurants';
  const industry = rawIndustry === 'Other Small Businesses' ? 'Other' : rawIndustry;
  const specialty = (filters.cuisine || '').trim();
  const customTerm = (filters.customIndustry || '').trim();
  const isAllSelected =
    !specialty ||
    specialty.toLowerCase() === 'all' ||
    specialty.toLowerCase() === 'all restaurants' ||
    specialty.toLowerCase() === `all ${industry.toLowerCase()}`;

  let prefix = industry;
  if (industry === 'Restaurants') {
    prefix = isAllSelected ? 'restaurants' : `${specialty} restaurants`;
  } else if (industry === 'Other') {
    prefix = customTerm || (isAllSelected ? 'small businesses' : specialty);
  } else {
    if (isAllSelected) {
      prefix = industry;
    } else if (specialty.toLowerCase().includes(industry.toLowerCase())) {
      prefix = specialty;
    } else {
      prefix = `${specialty} ${industry}`;
    }
  }

  return `${prefix} in ${filters.city.trim() || '...'}, ${filters.state}`;
}

export const SearchForm: React.FC<SearchFormProps> = ({
  filters,
  onChange,
  onSearch,
  isLoading,
}) => {
  const [activeDishTab, setActiveDishTab] = useState<number>(0);

  const selectedIndustry =
    filters.industry === 'Other Small Businesses' ? 'Other' : filters.industry || 'Restaurants';
  const isRestaurants = selectedIndustry === 'Restaurants';
  const isOther = selectedIndustry === 'Other';
  const industryNiches = INDUSTRY_SPECIALTIES[selectedIndustry] || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!filters.city.trim()) return;
    onSearch();
  };

  const handleIndustryChange = (newIndustry: string) => {
    onChange({
      ...filters,
      industry: newIndustry,
      customIndustry: newIndustry === 'Other' ? filters.customIndustry || '' : '',
      cuisine: newIndustry === 'Restaurants' ? 'All Restaurants' : '',
    });
  };

  const currentCategory = FAMOUS_DISH_CATEGORIES[activeDishTab];
  const queryPreview = buildPlaceSearchQuery(filters);

  return (
    <div className="bg-slate-800/85 border border-slate-700/80 rounded-2xl p-5 shadow-xl shadow-black/20 backdrop-blur-sm space-y-4">
      {/* Popular City Hubs Quick Selector */}
      <div className="flex items-center gap-1.5 flex-wrap pb-3 border-b border-slate-700/60">
        <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mr-1">
          <Globe2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Top Hubs:</span>
        </span>
        {POPULAR_CITY_HUBS.map((hub) => {
          const isSelected =
            filters.city.toLowerCase() === hub.city.toLowerCase() &&
            filters.state.toLowerCase() === hub.state.toLowerCase();
          return (
            <button
              key={hub.label}
              type="button"
              onClick={() => onChange({ ...filters, city: hub.city, state: hub.state })}
              className={`text-[11px] px-2.5 py-0.8 rounded-lg border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 border-slate-700/60 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              {hub.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Main Fields Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
          {/* Industry Dropdown */}
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
              <span>Business Industry</span>
            </label>
            <select
              value={selectedIndustry}
              onChange={(e) => handleIndustryChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors cursor-pointer"
            >
              {BUSINESS_INDUSTRIES.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </select>
          </div>

          {/* City */}
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>City (US / Territory)</span>
              <span className="text-emerald-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Austin, Chicago, Miami"
              value={filters.city}
              onChange={(e) => onChange({ ...filters, city: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
          </div>

          {/* State / Territory (Grouped) */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>State / Territory</span>
            </label>
            <select
              value={filters.state}
              onChange={(e) => onChange({ ...filters, state: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors cursor-pointer"
            >
              {US_REGIONS.map((region) => (
                <optgroup key={region.category} label={region.category}>
                  {region.states.map((s) => (
                    <option key={s.code} value={s.name}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Specialty / Dish / Custom Business Type Input */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              {isRestaurants ? (
                <Utensils className="w-3.5 h-3.5 text-indigo-400" />
              ) : (
                <Tag className="w-3.5 h-3.5 text-indigo-400" />
              )}
              <span>
                {isRestaurants
                  ? 'Dish / Cuisine'
                  : isOther
                  ? 'Custom Business Type'
                  : 'Niche / Specialty'}
              </span>
            </label>
            {isOther ? (
              <input
                type="text"
                placeholder="e.g. Dry Cleaners, Florist"
                value={filters.customIndustry || ''}
                onChange={(e) => onChange({ ...filters, customIndustry: e.target.value })}
                list="industry-niches-datalist"
                className="w-full bg-slate-900 border border-emerald-500/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-colors"
              />
            ) : (
              <input
                type="text"
                placeholder={
                  isRestaurants
                    ? 'e.g. Brisket, Ramen'
                    : industryNiches[0]
                    ? `e.g. ${industryNiches[0]}`
                    : 'Optional niche'
                }
                value={filters.cuisine}
                onChange={(e) => onChange({ ...filters, cuisine: e.target.value })}
                list={isRestaurants ? 'famous-dishes-datalist' : 'industry-niches-datalist'}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            )}
            <datalist id="famous-dishes-datalist">
              {FAMOUS_DISH_CATEGORIES.flatMap((c) => c.dishes).map((d) => (
                <option key={d.name} value={d.name} />
              ))}
            </datalist>
            <datalist id="industry-niches-datalist">
              {industryNiches.map((niche) => (
                <option key={niche} value={niche} />
              ))}
            </datalist>
          </div>

          {/* Min Rating */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-amber-400" />
              <span>Min Rating</span>
            </label>
            <select
              value={filters.minRating}
              onChange={(e) =>
                onChange({ ...filters, minRating: parseFloat(e.target.value) })
              }
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors cursor-pointer"
            >
              <option value="0">Any Rating</option>
              <option value="3.0">3.0+ Stars</option>
              <option value="3.5">3.5+ Stars</option>
              <option value="4.0">4.0+ Stars</option>
              <option value="4.5">4.5+ Stars</option>
            </select>
          </div>
        </div>

        {/* Specialty Explorer: Famous Dishes (for Restaurants) or Industry Niches (for Other Industries) */}
        {isRestaurants ? (
          <div className="pt-2 border-t border-slate-700/50 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-bold text-white">Famous Dishes &amp; Specialties:</span>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  Click any dish to auto-populate search
                </span>
              </div>

              {/* Category tabs */}
              <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1">
                {FAMOUS_DISH_CATEGORIES.map((cat, idx) => (
                  <button
                    key={cat.category}
                    type="button"
                    onClick={() => setActiveDishTab(idx)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                      activeDishTab === idx
                        ? 'bg-indigo-600 text-white font-bold shadow-sm'
                        : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat.category}
                  </button>
                ))}
              </div>
            </div>

            {/* Dishes Chips for active category */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => onChange({ ...filters, cuisine: 'All Restaurants' })}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                  filters.cuisine === 'All Restaurants' || !filters.cuisine
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                    : 'bg-slate-900/60 text-slate-400 border-slate-700/60 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                ★ All Restaurants
              </button>

              {currentCategory.dishes.map((dish) => {
                const isSelected =
                  filters.cuisine.toLowerCase() === dish.name.toLowerCase() ||
                  filters.cuisine.toLowerCase() === dish.query.toLowerCase();
                return (
                  <button
                    key={dish.name}
                    type="button"
                    onClick={() => onChange({ ...filters, cuisine: dish.name })}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold shadow-sm'
                        : 'bg-slate-900/60 text-slate-300 border-slate-700/70 hover:text-white hover:border-slate-500 hover:bg-slate-800'
                    }`}
                  >
                    {dish.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="pt-2 border-t border-slate-700/50 space-y-2">
            <div className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs font-bold text-white">
                {isOther
                  ? 'Custom Business Examples (or type any category above):'
                  : `${selectedIndustry} Niches & Categories:`}
              </span>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                {isOther ? 'Click any example or enter your own search term' : 'Optional sub-specialty filter'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...filters,
                    cuisine: '',
                    customIndustry: '',
                  })
                }
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                  isOther
                    ? !filters.customIndustry
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                      : 'bg-slate-900/60 text-slate-400 border-slate-700/60 hover:text-slate-200 hover:border-slate-600'
                    : !filters.cuisine || filters.cuisine.toLowerCase() === 'all'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                    : 'bg-slate-900/60 text-slate-400 border-slate-700/60 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                ★ {isOther ? 'All Small Businesses' : `All ${selectedIndustry}`}
              </button>

              {industryNiches.map((niche) => {
                const isSelected = isOther
                  ? (filters.customIndustry || '').toLowerCase() === niche.toLowerCase()
                  : filters.cuisine.toLowerCase() === niche.toLowerCase();
                return (
                  <button
                    key={niche}
                    type="button"
                    onClick={() =>
                      onChange(
                        isOther
                          ? { ...filters, customIndustry: niche }
                          : { ...filters, cuisine: niche }
                      )
                    }
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold shadow-sm'
                        : 'bg-slate-900/60 text-slate-300 border-slate-700/70 hover:text-white hover:border-slate-500 hover:bg-slate-800'
                    }`}
                  >
                    {niche}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Bar: Limits and Search Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-700/50">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>Query Preview:</span>
            <span className="font-mono text-emerald-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              {queryPreview}
            </span>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {/* Number of Results */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 font-medium flex items-center gap-1">
                <ListOrdered className="w-3.5 h-3.5" />
                <span>Limit:</span>
              </label>
              <select
                value={filters.maxResults}
                onChange={(e) =>
                  onChange({ ...filters, maxResults: parseInt(e.target.value, 10) })
                }
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="5">5 results</option>
                <option value="10">10 results</option>
                <option value="15">15 results</option>
                <option value="20">20 results</option>
                <option value="40">40 results</option>
                <option value="60">60 results</option>
                <option value="100">100 results</option>
              </select>
            </div>

            {/* Search Button */}
            <button
              type="submit"
              disabled={isLoading || !filters.city.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>
                    {filters.maxResults > 20
                      ? `Searching up to ${filters.maxResults}...`
                      : 'Searching Places...'}
                  </span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>
                    Search{' '}
                    {isOther
                      ? filters.customIndustry?.trim() || 'Businesses'
                      : selectedIndustry}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
