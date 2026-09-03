import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import SEOHead, { serviceSchema, faqSchema } from '../components/SEOHead';
import Navbar from '../components/Navbar';
import ProfessionalFooter from '../components/ProfessionalFooter';
import { Check, Globe, Shield, Zap, MessageSquare } from 'lucide-react';

/* ── Country data ──────────────────────────────────────────── */
const COUNTRIES = {
  'us': {
    name: 'United States', flag: '🇺🇸', code: '+1', region: 'North America',
    cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami'],
    price: '1.99', currency: 'USD',
    useCases: ['WhatsApp & Telegram verification', 'Google & Apple ID accounts', 'Business phone presence in the US', 'E-commerce & marketplace accounts', 'Banking & fintech apps'],
    keywords: 'USA virtual number, US phone number, American virtual number, +1 virtual number, US virtual number for WhatsApp, USA mobile number for international business, cheapest US virtual number monthly',
    description: 'Get a real US phone number (+1) starting at $1.99/month. No SIM card needed. Receive SMS and calls instantly. Perfect for WhatsApp, Google, Telegram, business verification, and building a US presence.',
  },
  'uk': {
    name: 'United Kingdom', flag: '🇬🇧', code: '+44', region: 'Europe',
    cities: ['London', 'Manchester', 'Birmingham', 'Glasgow', 'Leeds'],
    price: '1.99', currency: 'USD',
    useCases: ['UK business phone line', 'WhatsApp & Signal verification', 'HMRC & banking SMS', 'Amazon UK seller accounts', 'UK SIM-free presence'],
    keywords: 'UK virtual number, British phone number, +44 virtual number, UK virtual SIM, London virtual number, UK business phone number, cheapest UK virtual number',
    description: 'Get a real UK phone number (+44) starting at $1.99/month. London, Manchester, and nationwide numbers available. Instant activation, no SIM card required.',
  },
  'ca': {
    name: 'Canada', flag: '🇨🇦', code: '+1', region: 'North America',
    cities: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa'],
    price: '1.99', currency: 'USD',
    useCases: ['Canadian business presence', 'WhatsApp & iMessage verification', 'Marketplace & e-commerce accounts', 'Banking & tax SMS codes', 'Remote team local number'],
    keywords: 'Canada virtual number, Canadian phone number, +1 Canada number, Toronto virtual number, Vancouver virtual number, Canadian virtual SIM, cheapest Canadian virtual number',
    description: 'Get a real Canadian phone number (+1) starting at $1.99/month. Toronto, Vancouver, Montreal and nationwide. Instant activation, receive SMS and calls.',
  },
  'au': {
    name: 'Australia', flag: '🇦🇺', code: '+61', region: 'Oceania',
    cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide'],
    price: '5.25', currency: 'USD',
    useCases: ['Australian business number', 'WhatsApp verification in Australia', 'myGov & ATO SMS codes', 'Australian marketplace accounts', 'Local customer presence'],
    keywords: 'Australia virtual number, Australian phone number, +61 virtual number, Sydney virtual number, Melbourne virtual number, Australian virtual SIM, cheapest Australian number',
    description: 'Get a real Australian phone number (+61) starting at $5.25/month. Sydney, Melbourne, Brisbane and nationwide numbers. Instant activation, SMS-ready.',
  },
  'in': {
    name: 'India', flag: '🇮🇳', code: '+91', region: 'Asia',
    cities: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai'],
    price: '36.30', currency: 'USD',
    useCases: ['Indian business OTP verification', 'WhatsApp & JioSaavn accounts', 'UPI & banking SMS codes', 'Indian marketplace seller accounts', 'Startup verification numbers'],
    keywords: 'India virtual number, Indian phone number, +91 virtual number, Mumbai virtual number, India virtual SIM, cheapest Indian virtual number, India OTP number',
    description: 'Get a real Indian phone number (+91) starting at $36.30/month. Receive OTP codes, WhatsApp verification, and business SMS. Instant activation.',
  },
  'de': {
    name: 'Germany', flag: '🇩🇪', code: '+49', region: 'Europe',
    cities: ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne'],
    price: '2.70', currency: 'USD',
    useCases: ['German business phone number', 'WhatsApp & Signal verification', 'German banking SMS (TAN)', 'Amazon.de & eBay accounts', 'German GDPR-compliant presence'],
    keywords: 'Germany virtual number, German phone number, +49 virtual number, Berlin virtual number, Munich virtual number, German virtual SIM, cheapest German virtual number',
    description: 'Get a real German phone number (+49) starting at $2.70/month. Berlin, Munich, Hamburg and nationwide. Receive TAN codes, WhatsApp, and business SMS instantly.',
  },
  'fr': {
    name: 'France', flag: '🇫🇷', code: '+33', region: 'Europe',
    cities: ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Bordeaux'],
    price: '2.70', currency: 'USD',
    useCases: ['French business phone line', 'WhatsApp verification in France', 'French banking SMS codes', 'Amazon.fr & Leboncoin accounts', 'Local Paris presence'],
    keywords: 'France virtual number, French phone number, +33 virtual number, Paris virtual number, French virtual SIM, cheapest French virtual number, French OTP number',
    description: 'Get a real French phone number (+33) starting at $2.70/month. Paris, Lyon, Marseille and nationwide. Instant activation, perfect for business and verification.',
  },
  'nl': {
    name: 'Netherlands', flag: '🇳🇱', code: '+31', region: 'Europe',
    cities: ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven'],
    price: '1.99', currency: 'USD',
    useCases: ['Dutch business phone number', 'WhatsApp verification (very popular in NL)', 'DigiD & banking SMS codes', 'Marktplaats & bol.com accounts', 'EU headquarters presence'],
    keywords: 'Netherlands virtual number, Dutch phone number, +31 virtual number, Amsterdam virtual number, Dutch virtual SIM, Holland virtual number, cheapest Dutch virtual number',
    description: 'Get a real Dutch phone number (+31) starting at $1.99/month. Amsterdam, Rotterdam, The Hague and nationwide. Receive DigiD codes, WhatsApp, and business SMS.',
  },
  'es': {
    name: 'Spain', flag: '🇪🇸', code: '+34', region: 'Europe',
    cities: ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Bilbao'],
    price: '5.25', currency: 'USD',
    useCases: ['Spanish business phone number', 'WhatsApp verification in Spain', 'Spanish banking & Bizum SMS', 'Amazon.es & Wallapop accounts', 'Local Madrid/Barcelona presence'],
    keywords: 'Spain virtual number, Spanish phone number, +34 virtual number, Madrid virtual number, Barcelona virtual number, Spanish virtual SIM, cheapest Spanish virtual number',
    description: 'Get a real Spanish phone number (+34) starting at $5.25/month. Madrid, Barcelona, Valencia and nationwide. Instant activation for SMS, WhatsApp, and business calls.',
  },
  'mx': {
    name: 'Mexico', flag: '🇲🇽', code: '+52', region: 'Latin America',
    cities: ['Mexico City', 'Guadalajara', 'Monterrey', 'Cancún', 'Puebla'],
    price: '6.25', currency: 'USD',
    useCases: ['Mexican business phone number', 'WhatsApp verification in Mexico', 'Mexican banking OTP codes', 'MercadoLibre seller accounts', 'LATAM business presence'],
    keywords: 'Mexico virtual number, Mexican phone number, +52 virtual number, Mexico City virtual number, Mexican virtual SIM, cheapest Mexican virtual number, Mexico OTP number',
    description: 'Get a real Mexican phone number (+52) starting at $6.25/month. Mexico City, Guadalajara, Monterrey and nationwide. Instant SMS and OTP activation.',
  },
  'br': {
    name: 'Brazil', flag: '🇧🇷', code: '+55', region: 'Latin America',
    cities: ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador', 'Fortaleza'],
    price: '5.25', currency: 'USD',
    useCases: ['Brazilian business number', 'WhatsApp verification (Brazil is #1 WhatsApp country)', 'PIX & banking SMS', 'MercadoLivre accounts', 'CPF-linked verification'],
    keywords: 'Brazil virtual number, Brazilian phone number, +55 virtual number, São Paulo virtual number, Brazil WhatsApp number, Brazilian virtual SIM, cheapest Brazilian virtual number',
    description: 'Get a real Brazilian phone number (+55) starting at $5.25/month. São Paulo, Rio, Brasília and nationwide. Perfect for WhatsApp, PIX, and business verification.',
  },
  'sg': {
    name: 'Singapore', flag: '🇸🇬', code: '+65', region: 'Asia',
    cities: ['Singapore City', 'Jurong', 'Woodlands', 'Tampines', 'Ang Mo Kio'],
    price: '5.99', currency: 'USD',
    useCases: ['Singapore business phone number', 'Singpass & banking OTP', 'WhatsApp & Telegram verification', 'Southeast Asia business hub presence', 'E-commerce SG accounts'],
    keywords: 'Singapore virtual number, +65 virtual number, Singapore virtual SIM, SG phone number, cheapest Singapore virtual number, Singapore OTP number, Singapore business number',
    description: 'Get a real Singapore phone number (+65) starting at $5.99/month. Receive Singpass codes, WhatsApp, and business SMS instantly. No SIM card needed.',
  },
  'ng': {
    name: 'Nigeria', flag: '🇳🇬', code: '+234', region: 'Africa',
    cities: ['Lagos', 'Abuja', 'Kano', 'Ibadan', 'Port Harcourt'],
    price: '16.50', currency: 'USD',
    useCases: ['Nigerian business number', 'WhatsApp & business verification', 'Bank OTP SMS codes', 'Jumia & Konga seller accounts', 'Fintech app verification'],
    keywords: 'Nigeria virtual number, Nigerian phone number, +234 virtual number, Lagos virtual number, Nigeria virtual SIM, cheapest Nigerian virtual number, Nigeria OTP number',
    description: 'Get a real Nigerian phone number (+234) starting at $16.50/month. Lagos, Abuja, Kano and nationwide. Receive bank OTPs, WhatsApp, and business SMS instantly.',
  },
  'za': {
    name: 'South Africa', flag: '🇿🇦', code: '+27', region: 'Africa',
    cities: ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Port Elizabeth'],
    price: '5.25', currency: 'USD',
    useCases: ['South African business number', 'WhatsApp verification in ZA', 'SARS & banking OTP', 'Takealot & Gumtree accounts', 'African regional presence'],
    keywords: 'South Africa virtual number, South African phone number, +27 virtual number, Johannesburg virtual number, Cape Town virtual number, cheapest SA virtual number',
    description: 'Get a real South African phone number (+27) starting at $5.25/month. Johannesburg, Cape Town, Durban and nationwide. Instant SMS and OTP activation.',
  },
  'tr': {
    name: 'Turkey', flag: '🇹🇷', code: '+90', region: 'Europe / Asia',
    cities: ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya'],
    price: '5.99', currency: 'USD',
    useCases: ['Turkish business phone number', 'WhatsApp & Telegram verification', 'Turkish banking OTP', 'Trendyol & Hepsiburada accounts', 'Regional business presence'],
    keywords: 'Turkey virtual number, Turkish phone number, +90 virtual number, Istanbul virtual number, Turkey virtual SIM, cheapest Turkish virtual number, Turkey OTP number',
    description: 'Get a real Turkish phone number (+90) starting at $5.99/month. Istanbul, Ankara, Izmir and nationwide. Receive OTP codes, WhatsApp, and business SMS.',
  },
  'pl': {
    name: 'Poland', flag: '🇵🇱', code: '+48', region: 'Europe',
    cities: ['Warsaw', 'Kraków', 'Wrocław', 'Gdańsk', 'Poznań'],
    price: '3.75', currency: 'USD',
    useCases: ['Polish business number', 'WhatsApp & Messenger verification', 'Polish banking SMS codes', 'Allegro & OLX accounts', 'EU Eastern Europe presence'],
    keywords: 'Poland virtual number, Polish phone number, +48 virtual number, Warsaw virtual number, Poland virtual SIM, cheapest Polish virtual number, Poland OTP number',
    description: 'Get a real Polish phone number (+48) starting at $3.75/month. Warsaw, Kraków, Wrocław and nationwide. Instant SMS and OTP activation.',
  },
  'se': {
    name: 'Sweden', flag: '🇸🇪', code: '+46', region: 'Europe',
    cities: ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Linköping'],
    price: '1.99', currency: 'USD',
    useCases: ['Swedish business number', 'BankID SMS verification', 'WhatsApp & Signal', 'Blocket & Tradera accounts', 'Nordic business presence'],
    keywords: 'Sweden virtual number, Swedish phone number, +46 virtual number, Stockholm virtual number, Sweden virtual SIM, cheapest Swedish virtual number, Sweden BankID OTP',
    description: 'Get a real Swedish phone number (+46) starting at $1.99/month. Stockholm, Göteborg, Malmö and nationwide. Perfect for BankID, WhatsApp, and business SMS.',
  },
  'jp': {
    name: 'Japan', flag: '🇯🇵', code: '+81', region: 'Asia',
    cities: ['Tokyo', 'Osaka', 'Kyoto', 'Yokohama', 'Nagoya'],
    price: '5.99', currency: 'USD',
    useCases: ['Japanese business phone number', 'LINE & WhatsApp verification', 'Japanese banking OTP', 'Rakuten & Amazon Japan accounts', 'Local Japan business presence'],
    keywords: 'Japan virtual number, Japanese phone number, +81 virtual number, Tokyo virtual number, Japan virtual SIM, cheapest Japanese virtual number, Japan LINE verification',
    description: 'Get a real Japanese phone number (+81) starting at $5.99/month. Tokyo, Osaka, Kyoto and nationwide. Receive LINE, WhatsApp, and banking OTP codes instantly.',
  },
  'ru': {
    name: 'Russia', flag: '🇷🇺', code: '+7', region: 'Europe / Asia',
    cities: ['Moscow', 'Saint Petersburg', 'Novosibirsk', 'Yekaterinburg', 'Kazan'],
    price: '5.99', currency: 'USD',
    useCases: ['Russian business number', 'Telegram & VKontakte verification', 'Russian banking SMS', 'Avito & Wildberries accounts', 'Regional business presence'],
    keywords: 'Russia virtual number, Russian phone number, +7 virtual number, Moscow virtual number, Russia virtual SIM, cheapest Russian virtual number, Russia Telegram OTP',
    description: 'Get a real Russian phone number (+7) starting at $5.99/month. Moscow, Saint Petersburg and nationwide. Instant activation for Telegram, WhatsApp, and SMS.',
  },
  'it': {
    name: 'Italy', flag: '🇮🇹', code: '+39', region: 'Europe',
    cities: ['Rome', 'Milan', 'Naples', 'Turin', 'Florence'],
    price: '3.75', currency: 'USD',
    useCases: ['Italian business phone number', 'WhatsApp verification in Italy', 'Italian banking OTP', 'Subito.it & Amazon.it accounts', 'Local Rome/Milan presence'],
    keywords: 'Italy virtual number, Italian phone number, +39 virtual number, Rome virtual number, Milan virtual number, Italy virtual SIM, cheapest Italian virtual number',
    description: 'Get a real Italian phone number (+39) starting at $3.75/month. Rome, Milan, Naples and nationwide. Instant SMS, WhatsApp, and business phone activation.',
  },
  'ae': {
    name: 'United Arab Emirates', flag: '🇦🇪', code: '+971', region: 'Middle East',
    cities: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah'],
    price: '5.99', currency: 'USD',
    useCases: ['UAE business presence', 'WhatsApp & Telegram in UAE', 'Dubai bank OTP codes', 'Noon & Amazon.ae accounts', 'GCC market entry'],
    keywords: 'UAE virtual number, Dubai phone number, +971 virtual number, Abu Dhabi virtual number, UAE virtual SIM, cheapest Dubai virtual number, UAE WhatsApp number',
    description: 'Get a real UAE phone number (+971) starting at $5.99/month. Dubai, Abu Dhabi and nationwide. Receive SMS, WhatsApp OTP, and bank codes instantly.',
  },
  'sa': {
    name: 'Saudi Arabia', flag: '🇸🇦', code: '+966', region: 'Middle East',
    cities: ['Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam'],
    price: '5.99', currency: 'USD',
    useCases: ['Saudi business number', 'Absher & Tawakkalna SMS', 'WhatsApp verification', 'STC Pay & local fintech', 'KSA market presence'],
    keywords: 'Saudi Arabia virtual number, KSA phone number, +966 virtual number, Riyadh virtual number, Jeddah virtual SIM, cheapest Saudi virtual number',
    description: 'Get a real Saudi Arabian phone number (+966) starting at $5.99/month. Riyadh, Jeddah and nationwide. Instant SMS and OTP for Absher, banking, and WhatsApp.',
  },
  'eg': {
    name: 'Egypt', flag: '🇪🇬', code: '+20', region: 'Africa',
    cities: ['Cairo', 'Alexandria', 'Giza', 'Sharm El Sheikh', 'Luxor'],
    price: '5.99', currency: 'USD',
    useCases: ['Egyptian business number', 'WhatsApp & Telegram', 'Vodafone Cash & InstaPay OTP', 'Jumia & Souq accounts', 'North Africa market'],
    keywords: 'Egypt virtual number, Cairo phone number, +20 virtual number, Egyptian virtual SIM, cheapest Egypt virtual number, Egypt WhatsApp OTP',
    description: 'Get a real Egyptian phone number (+20) starting at $5.99/month. Cairo, Alexandria and nationwide. Instant SMS, WhatsApp, and fintech OTP activation.',
  },
  'lb': {
    name: 'Lebanon', flag: '🇱🇧', code: '+961', region: 'Middle East',
    cities: ['Beirut', 'Tripoli', 'Sidon', 'Tyre', 'Zahlé'],
    price: '5.99', currency: 'USD',
    useCases: ['Lebanese business number', 'WhatsApp & Viber verification', 'OMT & local banking SMS', 'Lebanese marketplace accounts', 'Diaspora presence'],
    keywords: 'Lebanon virtual number, Beirut phone number, +961 virtual number, Lebanese virtual SIM, cheapest Lebanon virtual number, Lebanon WhatsApp OTP',
    description: 'Get a real Lebanese phone number (+961) starting at $5.99/month. Beirut and nationwide. Receive WhatsApp, Viber, and bank SMS instantly — no SIM needed.',
  },
  'jo': {
    name: 'Jordan', flag: '🇯🇴', code: '+962', region: 'Middle East',
    cities: ['Amman', 'Zarqa', 'Irbid', 'Aqaba', 'Madaba'],
    price: '5.99', currency: 'USD',
    useCases: ['Jordanian business presence', 'WhatsApp & Telegram', 'eFAWATEERcom & banking SMS', 'Local marketplace accounts', 'Levant market'],
    keywords: 'Jordan virtual number, Amman phone number, +962 virtual number, Jordanian virtual SIM, cheapest Jordan virtual number',
    description: 'Get a real Jordanian phone number (+962) starting at $5.99/month. Amman and nationwide. Instant WhatsApp, banking, and business SMS activation.',
  },
  'ke': {
    name: 'Kenya', flag: '🇰🇪', code: '+254', region: 'Africa',
    cities: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret'],
    price: '5.99', currency: 'USD',
    useCases: ['Kenyan business number', 'M-Pesa & banking OTP', 'WhatsApp & Telegram', 'Jumia Kenya accounts', 'East Africa presence'],
    keywords: 'Kenya virtual number, Nairobi phone number, +254 virtual number, Kenyan virtual SIM, cheapest Kenya virtual number, M-Pesa OTP number',
    description: 'Get a real Kenyan phone number (+254) starting at $5.99/month. Nairobi, Mombasa and nationwide. Instant SMS for M-Pesa, WhatsApp, and business.',
  },
  'my': {
    name: 'Malaysia', flag: '🇲🇾', code: '+60', region: 'Asia',
    cities: ['Kuala Lumpur', 'George Town', 'Johor Bahru', 'Ipoh', 'Kota Kinabalu'],
    price: '5.99', currency: 'USD',
    useCases: ['Malaysian business number', 'WhatsApp & Telegram', 'Touch n Go & Maybank OTP', 'Lazada & Shopee accounts', 'ASEAN market'],
    keywords: 'Malaysia virtual number, Kuala Lumpur phone number, +60 virtual number, Malaysian virtual SIM, cheapest Malaysia virtual number',
    description: 'Get a real Malaysian phone number (+60) starting at $5.99/month. Kuala Lumpur and nationwide. Instant SMS, WhatsApp, and banking OTP.',
  },
  'th': {
    name: 'Thailand', flag: '🇹🇭', code: '+66', region: 'Asia',
    cities: ['Bangkok', 'Chiang Mai', 'Phuket', 'Pattaya', 'Krabi'],
    price: '15.00', currency: 'USD',
    useCases: ['Thai business number', 'LINE & WhatsApp verification', 'PromptPay & K Plus banking', 'Lazada Thailand accounts', 'Bangkok presence'],
    keywords: 'Thailand virtual number, Bangkok phone number, +66 virtual number, Thai virtual SIM, cheapest Thailand virtual number, Thailand LINE OTP',
    description: 'Get a real Thai phone number (+66) starting at $15.00/month. Bangkok, Phuket and nationwide. Instant LINE, WhatsApp, and PromptPay SMS activation.',
  },
  'ph': {
    name: 'Philippines', flag: '🇵🇭', code: '+63', region: 'Asia',
    cities: ['Manila', 'Cebu City', 'Davao', 'Quezon City', 'Makati'],
    price: '5.99', currency: 'USD',
    useCases: ['Filipino business number', 'GCash & Maya OTP', 'WhatsApp & Viber', 'Lazada & Shopee PH accounts', 'OFW family connection'],
    keywords: 'Philippines virtual number, Manila phone number, +63 virtual number, Filipino virtual SIM, cheapest Philippines virtual number, GCash OTP number',
    description: 'Get a real Filipino phone number (+63) starting at $5.99/month. Manila, Cebu and nationwide. Instant SMS for GCash, WhatsApp, and online accounts.',
  },
  'vn': {
    name: 'Vietnam', flag: '🇻🇳', code: '+84', region: 'Asia',
    cities: ['Ho Chi Minh City', 'Hanoi', 'Da Nang', 'Hai Phong', 'Can Tho'],
    price: '5.99', currency: 'USD',
    useCases: ['Vietnamese business number', 'Zalo & WhatsApp verification', 'MoMo & VNPay OTP', 'Tiki & Shopee VN accounts', 'SE Asia growth markets'],
    keywords: 'Vietnam virtual number, Ho Chi Minh phone number, +84 virtual number, Vietnamese virtual SIM, cheapest Vietnam virtual number, Vietnam Zalo OTP',
    description: 'Get a real Vietnamese phone number (+84) starting at $5.99/month. Ho Chi Minh City, Hanoi and nationwide. Instant Zalo, WhatsApp, and fintech SMS.',
  },
  'kr': {
    name: 'South Korea', flag: '🇰🇷', code: '+82', region: 'Asia',
    cities: ['Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon'],
    price: '5.99', currency: 'USD',
    useCases: ['Korean business number', 'KakaoTalk verification', 'Naver & Coupang accounts', 'Toss & KakaoBank OTP', 'K-business presence'],
    keywords: 'South Korea virtual number, Seoul phone number, +82 virtual number, Korean virtual SIM, cheapest Korea virtual number, Korea KakaoTalk OTP',
    description: 'Get a real South Korean phone number (+82) starting at $5.99/month. Seoul, Busan and nationwide. Instant KakaoTalk, Naver, and banking SMS.',
  },
  'hk': {
    name: 'Hong Kong', flag: '🇭🇰', code: '+852', region: 'Asia',
    cities: ['Central', 'Kowloon', 'Tsim Sha Tsui', 'Mong Kok', 'Causeway Bay'],
    price: '5.99', currency: 'USD',
    useCases: ['Hong Kong business presence', 'WhatsApp & WeChat', 'HSBC & Hang Seng OTP', 'Octopus & PayMe SMS', 'APAC business hub'],
    keywords: 'Hong Kong virtual number, +852 virtual number, HK phone number, Hong Kong virtual SIM, cheapest Hong Kong virtual number',
    description: 'Get a real Hong Kong phone number (+852) starting at $5.99/month. Instant SMS for WhatsApp, banking OTP, and APAC business presence.',
  },
  'nz': {
    name: 'New Zealand', flag: '🇳🇿', code: '+64', region: 'Oceania',
    cities: ['Auckland', 'Wellington', 'Christchurch', 'Hamilton', 'Tauranga'],
    price: '5.25', currency: 'USD',
    useCases: ['NZ business number', 'WhatsApp & Signal', 'Trade Me & banking SMS', 'Local Auckland presence', 'Oceania market'],
    keywords: 'New Zealand virtual number, Auckland phone number, +64 virtual number, NZ virtual SIM, cheapest New Zealand virtual number',
    description: 'Get a real New Zealand phone number (+64) starting at $5.25/month. Auckland, Wellington and nationwide. Instant SMS for Trade Me, WhatsApp, and business.',
  },
  'ar': {
    name: 'Argentina', flag: '🇦🇷', code: '+54', region: 'Latin America',
    cities: ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'La Plata'],
    price: '5.25', currency: 'USD',
    useCases: ['Argentine business number', 'WhatsApp (huge in AR)', 'Mercado Pago OTP', 'Mercado Libre accounts', 'LATAM presence'],
    keywords: 'Argentina virtual number, Buenos Aires phone number, +54 virtual number, Argentine virtual SIM, cheapest Argentina virtual number',
    description: 'Get a real Argentine phone number (+54) starting at $5.25/month. Buenos Aires, Córdoba and nationwide. Instant WhatsApp and Mercado Pago SMS.',
  },
  'cl': {
    name: 'Chile', flag: '🇨🇱', code: '+56', region: 'Latin America',
    cities: ['Santiago', 'Valparaíso', 'Concepción', 'La Serena', 'Antofagasta'],
    price: '7.50', currency: 'USD',
    useCases: ['Chilean business number', 'WhatsApp verification', 'Banco Estado & Falabella OTP', 'MercadoLibre Chile accounts', 'Southern cone presence'],
    keywords: 'Chile virtual number, Santiago phone number, +56 virtual number, Chilean virtual SIM, cheapest Chile virtual number',
    description: 'Get a real Chilean phone number (+56) starting at $7.50/month. Santiago and nationwide. Instant WhatsApp, banking, and e-commerce SMS.',
  },
  'co': {
    name: 'Colombia', flag: '🇨🇴', code: '+57', region: 'Latin America',
    cities: ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena'],
    price: '16.50', currency: 'USD',
    useCases: ['Colombian business number', 'Nequi & Daviplata OTP', 'WhatsApp verification', 'MercadoLibre & Rappi accounts', 'Andean market presence'],
    keywords: 'Colombia virtual number, Bogotá phone number, +57 virtual number, Colombian virtual SIM, cheapest Colombia virtual number, Nequi OTP number',
    description: 'Get a real Colombian phone number (+57) starting at $16.50/month. Bogotá, Medellín and nationwide. Instant Nequi, WhatsApp, and Rappi SMS.',
  },
  'ng': {
    name: 'Nigeria', flag: '🇳🇬', code: '+234', region: 'Africa',
    cities: ['Lagos', 'Abuja', 'Kano', 'Ibadan', 'Port Harcourt'],
    price: '16.50', currency: 'USD',
    useCases: ['Nigerian business number', 'OPay & PalmPay OTP', 'WhatsApp verification', 'Jumia & Konga accounts', 'West Africa hub presence'],
    keywords: 'Nigeria virtual number, Lagos phone number, +234 virtual number, Nigerian virtual SIM, cheapest Nigeria virtual number, OPay OTP number',
    description: 'Get a real Nigerian phone number (+234) starting at $16.50/month. Lagos, Abuja and nationwide. Instant SMS for OPay, WhatsApp, and business OTP.',
  },
};

const FALLBACK = {
  name: 'International', flag: '🌍', code: '+X', region: 'Global',
  cities: [], price: '1.99', currency: 'USD',
  useCases: ['SMS & OTP verification', 'Business phone presence', 'WhatsApp & Telegram', 'E-commerce accounts', 'Privacy protection'],
  keywords: 'virtual phone number, buy virtual number, international virtual number, online phone number, SMS verification number',
  description: 'Get a mobile virtual phone number starting at $1.99/month. Receive SMS and OTP codes instantly. Available in US, CA, GB, NL, SE, and PR.',
};

/* ── Component ──────────────────────────────────────────────── */
export default function CountryVirtualNumberPage() {
  const { countrySlug } = useParams();
  const navigate = useNavigate();
  const country = COUNTRIES[countrySlug?.toLowerCase()] || FALLBACK;

  const pageTitle = `${country.flag} ${country.name} Virtual Phone Number | ${country.code} | From $${country.price}/mo`;
  const pageDesc = country.description;

  const combinedSchema = {
    '@graph': [
      serviceSchema(
        `${country.name} Virtual Phone Number`,
        country.description,
        country.price,
      ),
      faqSchema([
        { q: `How do I get a ${country.name} virtual number?`, a: `Sign up free at Calliotel, add balance, and pick a ${country.name} (${country.code}) number from our pool. The number activates instantly — no SIM card needed.` },
        { q: `How much does a ${country.name} virtual number cost?`, a: `${country.name} virtual numbers start at $${country.price}/month with no setup fee and no hidden charges. Cancel anytime.` },
        { q: `Can I receive WhatsApp OTP on a ${country.name} virtual number?`, a: `Yes. Our ${country.name} numbers are real carrier-grade numbers that receive SMS and voice calls, including WhatsApp, Telegram, and all major app verifications.` },
        { q: `Is there a contract for the ${country.name} number?`, a: `No. Month-to-month billing only. Cancel anytime from your dashboard with no fees.` },
      ]),
    ],
  };

  return (
    <div className="min-h-screen text-white" style={{ background: '#060610' }}>
      <SEOHead
        title={pageTitle}
        description={pageDesc}
        keywords={country.keywords}
        path={`/virtual-number/${countrySlug}`}
        schema={combinedSchema}
      />
      <Navbar />

      {/* Hero */}
      <section style={{ padding: '120px 0 80px', textAlign: 'center' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div style={{ fontSize: 72, marginBottom: 16 }}>{country.flag}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 100, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 11, fontWeight: 700, color: '#10b981', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 20 }}>
            {country.code} · {country.region}
          </div>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 60px)', fontWeight: 900, lineHeight: 1.1, marginBottom: 20, letterSpacing: '-1px' }}>
            {country.name} Virtual<br />
            <span style={{ background: 'linear-gradient(135deg, #10b981, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Phone Number</span>
          </h1>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.55)', maxWidth: 560, margin: '0 auto 36px', lineHeight: 1.7 }}>
            {country.description}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
            <button onClick={() => navigate('/signup')} style={{
              padding: '15px 36px', borderRadius: 14, fontSize: 16, fontWeight: 800,
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff', border: 'none', cursor: 'pointer',
              boxShadow: '0 8px 32px rgba(16,185,129,0.4)',
            }}>
              Get a {country.name} Number →
            </button>
            <button onClick={() => navigate('/pricing')} style={{
              padding: '15px 28px', borderRadius: 14, fontSize: 15, fontWeight: 600,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff', cursor: 'pointer',
            }}>
              View Pricing
            </button>
          </div>
          <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['No setup fee', `From $${country.price}/mo`, 'Instant activation', 'Cancel anytime'].map((t, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                <Check style={{ width: 14, height: 14, color: '#10b981' }} /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section style={{ padding: '60px 0', background: 'rgba(255,255,255,0.018)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 style={{ fontSize: 28, fontWeight: 800, textAlign: 'center', marginBottom: 8 }}>
            Why people get a {country.name} number
          </h2>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', marginBottom: 36, fontSize: 15 }}>
            Popular uses for {country.code} virtual numbers on Calliotel
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {country.useCases.map((uc, i) => (
              <div key={i} style={{
                display: 'flex', gap: 14, alignItems: 'flex-start',
                padding: '18px 20px', borderRadius: 16,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {[<MessageSquare size={16} />, <Shield size={16} />, <Globe size={16} />, <Zap size={16} />, <Check size={16} />][i % 5]}
                </div>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: 1.5 }}>{uc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cities */}
      {country.cities.length > 0 && (
        <section style={{ padding: '60px 0' }}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
              {country.name} Numbers by City
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 28, fontSize: 14 }}>
              Get local numbers for major {country.name} cities
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {country.cities.map((city, i) => (
                <button key={i} onClick={() => navigate('/signup')} style={{
                  padding: '10px 20px', borderRadius: 100, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)',
                  transition: 'all 0.2s',
                }}>
                  {country.flag} {city}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Why Calliotel */}
      <section style={{ padding: '60px 0', background: 'rgba(255,255,255,0.018)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 style={{ fontSize: 28, fontWeight: 800, textAlign: 'center', marginBottom: 36 }}>
            Why Calliotel for {country.name} numbers?
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {[
              { icon: '💰', title: `From $${country.price}/month`, desc: 'No setup fee, no contracts. The cheapest long-term virtual numbers on the market.' },
              { icon: '⚡', title: 'Instant Activation', desc: 'Your number is ready the moment you pay. No waiting, no paperwork.' },
              { icon: '🔒', title: 'Complete Privacy', desc: 'Your real number is never exposed. Stay anonymous and secure online.' },
              { icon: '📶', title: 'Tier-1 Carrier Quality', desc: 'Real carrier-grade DID numbers — not VoIP workarounds. Reliable SMS delivery.' },
            ].map((item, i) => (
              <div key={i} style={{
                padding: '22px 20px', borderRadius: 16,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center',
              }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>{item.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{item.title}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular services for this country */}
      <section style={{ padding: '60px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 style={{ fontSize: 28, fontWeight: 800, textAlign: 'center', marginBottom: 8 }}>
            Verify any app with your {country.name} number
          </h2>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.55)', marginBottom: 28, fontSize: 14 }}>
            Real {country.code} numbers — works with every major app and service.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {[
              { slug: 'whatsapp', label: '💬 WhatsApp' },
              { slug: 'telegram', label: '✈️ Telegram' },
              { slug: 'google', label: '🔍 Google / Gmail' },
              { slug: 'instagram', label: '📸 Instagram' },
              { slug: 'tiktok', label: '🎵 TikTok' },
              { slug: 'facebook', label: '👥 Facebook' },
              { slug: 'discord', label: '🎮 Discord' },
              { slug: 'apple', label: '\u{F8FF} Apple ID' },
              { slug: 'microsoft', label: '🪟 Microsoft' },
              { slug: 'amazon', label: '📦 Amazon' },
              { slug: 'paypal', label: '💳 PayPal' },
              { slug: 'uber', label: '🚗 Uber' },
            ].map((s) => (
              <Link
                key={s.slug}
                to={`/verify/${s.slug}`}
                style={{
                  padding: '14px 16px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#fff', textDecoration: 'none',
                  fontSize: 14, fontWeight: 600,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span>{s.label}</span>
                <span style={{ color: '#10b981' }}>→</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '60px 0' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 style={{ fontSize: 28, fontWeight: 800, textAlign: 'center', marginBottom: 32 }}>
            Frequently Asked Questions
          </h2>
          {[
            { q: `How do I get a ${country.name} virtual number?`, a: `Sign up free at Calliotel, add balance, and pick a ${country.name} (${country.code}) number from our pool. Your number activates instantly — no SIM card or ID required.` },
            { q: `How much does it cost?`, a: `${country.name} numbers start at $${country.price}/month with no setup fee. Cancel any time from your dashboard — no cancellation fees.` },
            { q: `Can I receive WhatsApp OTP on this number?`, a: `Yes. All our numbers are real carrier-grade numbers that receive SMS from any sender, including WhatsApp, Telegram, Google, Apple, and banks.` },
            { q: `Is there a contract?`, a: `No contracts. Month-to-month billing. Cancel anytime.` },
          ].map(({ q, a }, i) => (
            <div key={i} style={{ marginBottom: 16, padding: '20px 24px', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{q}</p>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.6 }}>{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '60px 0 100px', textAlign: 'center' }}>
        <div className="max-w-xl mx-auto px-4">
          <div style={{ fontSize: 40, marginBottom: 16 }}>{country.flag}</div>
          <h2 style={{ fontSize: 32, fontWeight: 900, marginBottom: 12 }}>
            Get Your {country.name} Number Now
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: 28, fontSize: 15 }}>
            Start in 60 seconds. No setup fee. No SIM card. Cancel anytime.
          </p>
          <button onClick={() => navigate('/signup')} style={{
            padding: '16px 40px', borderRadius: 14, fontSize: 16, fontWeight: 800,
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#fff', border: 'none', cursor: 'pointer',
            boxShadow: '0 8px 32px rgba(16,185,129,0.4)',
          }}>
            Create Free Account →
          </button>
        </div>
      </section>

      <ProfessionalFooter />
    </div>
  );
}
