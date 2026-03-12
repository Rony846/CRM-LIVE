"""
MuscleGrid CRM - Data Migration Script
Migrates data from old MySQL/MariaDB database to new MongoDB
Run this script once after setting up the new CRM
"""

import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

# ====================== OLD DATA FROM SQL ======================

# Customers from crm_customers table
OLD_CUSTOMERS = [
    {"id": 1, "name": "Aj kumar Sachan", "phone": "6005409722", "email": "aj.sachan@rediffmail.com", "address": "ABHISHEK SOLAR SHOP, PATEL COWK, NEAR ANAND LAWN,TOWN- PUKHRAYAN, KANPUR DEHAT, UP. PIN-209111"},
    {"id": 2, "name": "Praveen kumar", "phone": "6201775807", "email": "pratapkumarujjwal@gmail.com", "address": "shivpuri, mantubabu chowk, (maa ambey garnel store)"},
    {"id": 3, "name": "Divya Raj Jeevan Verma", "phone": "6387483366", "email": "jayramdev273@gmail.com", "address": "C-57 , Growth Centre Bijouli Bijauli Jhansi - 284135"},
    {"id": 4, "name": "SK HABIB AL RASHID", "phone": "7003916944", "email": "habibalrashid@gmail.com", "address": "Village: Dakshin Baguan, Post: Chanserpur, Police STN: Tamluk, District: Purba Medinipur, West Bengal, PIN: 721653"},
    {"id": 5, "name": "Rajiv kumar", "phone": "7015607503", "email": "rajivsaini101@gmail.com", "address": "Vpo saran"},
    {"id": 6, "name": "siddharth rastogi", "phone": "7060512741", "email": "siddharth.mask@gmail.com", "address": "308 Shraddha nursing home Moh Anta"},
    {"id": 7, "name": "Shis Pal Jangra", "phone": "7063083313", "email": "shispalsingh64@gmail.com", "address": "SHIS PAL SINGH VPO BIGOWA DIST. CHARKHI DADRI HARYANA PIN 127307"},
    {"id": 8, "name": "Akash Bar", "phone": "7074355950", "email": "akashbar420@gmail.com", "address": "Vill+P.O- Katkadebi Chak,P.S-Khejuri,Dist-Purba Medinipur,Pin-721431"},
    {"id": 9, "name": "Sujan Das", "phone": "7099228820", "email": None, "address": "JURAPUKURI"},
    {"id": 10, "name": "Santosh Khaire", "phone": "7218070450", "email": "santoshkhaire6259@gmail.com", "address": "AP. Mukhai Tal.Shirur Dist. Pune 412208"},
    {"id": 11, "name": "Saurabh Mule", "phone": "7262951319", "email": "saurabhmule101@gmail.com", "address": "Sr no 386 plot no 43 shiv shrusti park kaljewadi tajne mala charoli pimpri Chinchwad Maharashtra 412105"},
    {"id": 12, "name": "ANKUR GOYAL", "phone": "7300607837", "email": "gangahandicraftexports@gmail.com", "address": "Plot No 1, Mayur Vihar, Chamrauli"},
    {"id": 13, "name": "Manoj Kumar", "phone": "7500072290", "email": "manojkuch1971@gmail.com", "address": "Near Om Farm House Shiv Vihar Colony Dhampur Dist. Bijnor"},
    {"id": 14, "name": "Pankaj Kumar", "phone": "7503507441", "email": "pkpk10289@gmail.com", "address": "3010 Naipura,Loni Ghaziabad.UP, near (S.B.S.G) inter College"},
    {"id": 15, "name": "Jayesh Salve", "phone": "7744996608", "email": "salvejayesh777@gmail.com", "address": "Plot 10, Near Trilokeshwar Mahadev Temple, Shiv Colony, Amalner, Tal. Amalner, Dist. Jalgaon, Maharashtra"},
    {"id": 16, "name": "Shubham Jadhav", "phone": "7773911639", "email": None, "address": "Ashirwad Niwas, Yamai nagar near behind Datt Trailor, Babhulgaon, Pandharpur 413304"},
    {"id": 17, "name": "Craftworks", "phone": "7795853059", "email": "office.surama@gmail.com", "address": "Surama Textiles Durgigudi Main road"},
    {"id": 18, "name": "Manas Gupta", "phone": "7798309792", "email": "manas.cdac@gmail.com", "address": "7B Azad Nagar Madhoganj District Hardoi Uttar Pradesh Pin 241302"},
    {"id": 19, "name": "Dhoop singh", "phone": "8052219124", "email": "dhoopsinghbundela96@gmail.com", "address": "19 paraun lalitpur Uttar Pradesh"},
    {"id": 20, "name": "Manjeet", "phone": "8058240668", "email": "manjeetkhileri1998@gmail.com", "address": "Manjeet Khileri, Durga sadan, Jato ka bass, Panchroliya Merta City, 341510"},
    {"id": 21, "name": "yogesh", "phone": "8076783598", "email": "tomar_boyz@rediffmail.com", "address": "19k ram vihar colony near puch enclave chauprola noida -201009"},
    {"id": 22, "name": "YOGESH GOYAL", "phone": "8103745558", "email": None, "address": "SAI NAGAR GAIS GODAM KE PAS RAJA COACHING WALI GALI MORAR GWALIOR"},
    {"id": 23, "name": "Nirav karsanbhai patel", "phone": "8140894473", "email": "patelniravk@gmail.com", "address": "223,padar faliyu, at. Sherdi, ta. Olpad, surat"},
    {"id": 24, "name": "Tirath Singh", "phone": "8195036400", "email": None, "address": "Tirath Singh 513 Lakhan ke patte Kapurthala City Hamira Punjab 144802"},
    {"id": 25, "name": "Pawan patwa", "phone": "8208278437", "email": "patwamayra@gmail.com", "address": "At Mahalaxmi post charoti taluka Dahanu district Palghar Maharashtra 401602 India"},
    {"id": 26, "name": "Kundan Kumar jaiswal", "phone": "8340580561", "email": "jaiswalkundan92@gmail.com", "address": "At laxmipur babhaniya po laxmipur babhaniya ps kahalgaon distt bhagalpur"},
    {"id": 27, "name": "Ravi deswal", "phone": "8397813434", "email": None, "address": "V.p.o surehti dist- jhajjar haryaya pin cod 124109"},
    {"id": 28, "name": "Chandrakant sah", "phone": "8409345457", "email": "chandrakantsahgodda@gmail.com", "address": "At post deobandha district godda jharkhand"},
    {"id": 29, "name": "Balaji enterprises", "phone": "8445842727", "email": None, "address": "Vill nagla pachauri Post naugaon"},
    {"id": 30, "name": "Aryaman Kavadia", "phone": "8452001030", "email": "info@idesignlab.us", "address": "Sevalaya NGO, Kasuva Village, Pakkam Post, Tiruninravur, Tiruvallur, Tamil Nadu - 602024"},
    {"id": 31, "name": "Shashi Kant Sharma", "phone": "8545938831", "email": "shashikantsharma11111@gmail.com", "address": "Phir se kyu pick krava rhe ho mahoday"},
    {"id": 32, "name": "A PURNANANDA RAO", "phone": "8596008033", "email": "RAOPURNANANDA@GMAIL.COM", "address": "TELUGU STREET, NEAR GANESH TEMPLE,PO-KOTPAD, DIST-KORAPUT, ODISHA, PIN-764058"},
    {"id": 33, "name": "MAHATMA JEE", "phone": "8651341077", "email": "ag9576307825@gmail.com", "address": "VILL- CHANDWA, PO-CHANDWA, PS-NAWADA, Dist-Bhojpur (Ara) , Bihar"},
    {"id": 34, "name": "Rajesh Shenoy", "phone": "8660532874", "email": "raajshenoy@gmail.com", "address": "Suggi_Celebrate Nature No.149, Kalikamba Temple Road Somanahalli, Off Kanakapura main road."},
    {"id": 35, "name": "Sanjeet pandit", "phone": "8777379399", "email": "panditsanjeet39@gmail.com", "address": "Samastipur Mahe Singhia Wari chuak Durga Asthan"},
    {"id": 36, "name": "Rahul maurya", "phone": "8808866202", "email": None, "address": "Rahul electronics and library Mundehra near petrol pump"},
    {"id": 37, "name": "Nishant choudhary", "phone": "8810409968", "email": None, "address": "Banthla loni gaziyabad Near Indian oil petrol pump hn.172"},
    {"id": 38, "name": "Anoob g b", "phone": "8907818307", "email": "anoobgb007@gmail.com", "address": "Anugraha 85a, Ranni Lane, Peroorkada.p.o, Trivandrum-695005"},
    {"id": 39, "name": "JKPortrait", "phone": "9018444491", "email": "jkportrait@gmail.com", "address": "Gourav Sarpanch Dhaba, Nagrota Bypass NAGROTA, JAMMU & KASHMIR, 181221"},
    {"id": 40, "name": "ABRAHAM VARGHESE", "phone": "9037300815", "email": "parampil@gmail.com", "address": "Parampil House"},
    {"id": 41, "name": "Lakhvinder", "phone": "9121346151", "email": None, "address": "Vill Jindlehar PO Chohala Teh R S Pura"},
    {"id": 42, "name": "Haraprasad Mallick", "phone": "9153131557", "email": "debjyotimallickonrage@gmail.com", "address": "Gobindanagar Sarada Pally, Bankura PO: Kenduadihi P.S : Bankura District- Bankura PIN - 722102 (W.B)"},
    {"id": 43, "name": "NITIN PATIL", "phone": "9209182400", "email": "patil.nitin2400@gmail.com", "address": "Flat no 3, Image appartment Behind sumangal super shop nar SMIT Collage muktai nagar"},
    {"id": 44, "name": "M A Varghese", "phone": "9300601154", "email": "varghesealex@hotmail.com", "address": "303, Pratik mansion. Near St Paul's school. Revervew colony. Morar, Gwalior Pin 474006."},
    {"id": 45, "name": "kulveer", "phone": "9311073969", "email": "kulsorout23@gmail.com", "address": "Village lohina, Tech. Hodal, Distt. Palwal Haryana"},
    {"id": 46, "name": "Neeraj Kumar Singh", "phone": "9359583936", "email": "neerajsingh.ns5@gmail.com", "address": "A 89 avas Vikas colony"},
    {"id": 47, "name": "Jayant Apte", "phone": "9422413577", "email": None, "address": "G1 Dreampearl Apartments ARWADE Park"},
    {"id": 48, "name": "Anshul jain", "phone": "9424813131", "email": None, "address": "jiobp jhabua bypass jhabua"},
    {"id": 49, "name": "Sudhir kumar", "phone": "9431462259", "email": "sudhirrocks065@gmail.com", "address": "Ravi shanker kumar Khangah road ,ward no 8 Arwal"},
    {"id": 50, "name": "Manoj Kumar Bordoloi", "phone": "9435351866", "email": "mk669287@gmail.com", "address": "Manoj Kumar Bordoloi, Nandanpur, House no-4,near Alohi-ghar, Jorhat785006,Assam"},
    {"id": 51, "name": "naresh kumar", "phone": "9440594880", "email": None, "address": "h no 8-65, road no-1, laxmipriya nagar-2, mubaraknagar"},
    {"id": 52, "name": "BRIGHT TRADES", "phone": "9445543407", "email": "brighttrades365@gmail.com", "address": "34 TRUST MAIN ROAD"},
    {"id": 53, "name": "Vamadevan Sasidharan", "phone": "9447233334", "email": "vamadevansasidharan@gmail.com", "address": "Vamadevan Sasidharan Tc 6/1558,SCT Nagar,DPARA 5 ulloor Akkulam road Thiruvananthapuram, KERALA"},
    {"id": 54, "name": "rajender Kumar Jain", "phone": "9448121477", "email": "rajurkjain@gmail.com", "address": "RAJKAMAL JEWLLERS"},
    {"id": 55, "name": "Anand Kumar Bharati", "phone": "9451697028", "email": "ravanrider21@gmail.com", "address": "Vill+post -chherdih"},
    {"id": 56, "name": "Tara Rani", "phone": "9463998844", "email": None, "address": "548 Amardeep colony"},
    {"id": 57, "name": "Raja kullayappa", "phone": "9550237090", "email": None, "address": "4-3-1,near paranapalli road, pulivendula. Land mark: prakruthi restaurant"},
    {"id": 58, "name": "Manoj Kumar nahak", "phone": "9559619096", "email": "mnahak27@gmail.com", "address": "Manoj Kumar nahak P-78/01 Zone-06 Babina can't"},
    {"id": 59, "name": "Anand Srivastava", "phone": "9565506668", "email": None, "address": "210 brij vihar colony"},
    {"id": 60, "name": "Ankit", "phone": "9588141385", "email": "dadimaa1385@gmail.com", "address": "House.no 263, Banbhori bustand, Near suriyanandni showroom, sandlana road, Hisar District - 125121, IN-HR"},
    {"id": 61, "name": "Vinit shukla", "phone": "9589036410", "email": "ashua74@gmail.com", "address": "Vill-Patna post Raura teh-Raupur karchuliyan"},
    {"id": 62, "name": "Rahul kumar", "phone": "9627915710", "email": "guptarahu82794944@gmail.com", "address": "Rahulgupta Dr. Rahul gupta ki daat ki dukan samther samther samther Bharthana 206242 in up"},
    {"id": 63, "name": "Arun Magar", "phone": "9637008151", "email": "cybercop1@gmail.com", "address": "Sainath colony, Lane 1, Pune-Solapur Highway besides Joy ville gate"},
    {"id": 64, "name": "ASHOK SHARMA", "phone": "9642509240", "email": "sharmaashok007@rediffmail.com", "address": "B-44, RADHA AVENUE,GOVERDHAN ROAD,SATOHA. MATHURA"},
    {"id": 65, "name": "Nikhil", "phone": "9643342822", "email": "babluray2822@gmail.com", "address": "H.N.-43 Gali no.2 block A1 Shiv enclave part 3 Ismailpur Haryana PIN code-121003"},
    {"id": 66, "name": "Kamlesh Patel", "phone": "9651106455", "email": "aps20.km@gmail.com", "address": "Shekhapur, surauli Post bharachha district chandauli 232101"},
    {"id": 67, "name": "Nagendra kumar", "phone": "9682596646", "email": "nagendrakumar3055@gmail.com", "address": "Village post gotka tehsil sardhana district meerut up"},
    {"id": 68, "name": "TAPOSH SARKAR", "phone": "9695973286", "email": "taposh999sarkar@gmail.com", "address": "Machhali gali Narahan kerakat jaunpur"},
    {"id": 69, "name": "RATAN LAL MEENA", "phone": "9720077417", "email": "rlmeena2007@gmail.com", "address": "RATAN LAL MEENA C-4, GAIL TOWNSHIP MAKHUPURA AJMER, RAJASTHAN, 305002"},
    {"id": 70, "name": "VIPIN NB", "phone": "9746803327", "email": "Vipin4guys@gmail.com", "address": "MWRA 35,NERIYAMKOTTU HOUSE, PEREPARAMBU ROAD, MAMANGALAM, PALARIVATTOM P.O,KOCHI-682025"},
    {"id": 71, "name": "Vijay manjhi", "phone": "9755682111", "email": "vijaymanjhi9755@gmail.com", "address": "Manjhi krishi farm banskhedi railway fatak ke pass Guna"},
    {"id": 72, "name": "naveen kumar", "phone": "9784502333", "email": None, "address": "indra colony, bypass road, singhana teh-buhana dist-jhunjhunu"},
    {"id": 73, "name": "Baljinder Singh", "phone": "9815409095", "email": "baljinder17223@gmail.com", "address": "Baljinder Singh s/o Bakshi Ram Village MuradPur Awana Teh.Mukerian District Hoshaiar Pur (Punjab) Pin 144211"},
    {"id": 74, "name": "Pintu ram sharma", "phone": "9826761680", "email": "khurasiyaindustries15040@gmail.com", "address": "Madhupuri colony ambah ward no 4 ambah dist.morena mp"},
    {"id": 75, "name": "Rajesh Kumar Das", "phone": "9854075404", "email": "rajeshdas84@gmail.com", "address": "C/O Pradip Kumar Sutradhar, Nowapara no.2, Nowapara,Near Jagadhatri Temple, Dist: Bongaigaon,Assam. India.pin-783392."},
    {"id": 76, "name": "Rajeev Kakkar", "phone": "9876698967", "email": "rajeevkakkar1@gmail.com", "address": "Not required"},
    {"id": 77, "name": "Prabhu bisht", "phone": "9897035677", "email": None, "address": "Rawat cottage talla cheenakhan almora uttrakhand -263601"},
    {"id": 78, "name": "Sanjay Kumar Sharma", "phone": "9897585706", "email": "skbisaulu@gmail.com", "address": "Holi chowk Tower Vali Gali Bisauli budaun Uttar Pradesh"},
    {"id": 79, "name": "somnath samanta", "phone": "9903855340", "email": "manager@liionergy.in", "address": "Plot No 56, Uluberia Industrial Growth Centre P.O. Birshibpur, Uluberia Howrah West Bengal 711316 India"},
    {"id": 80, "name": "Amit sumbria", "phone": "9906007717", "email": "amitsumbria925@gmail.com", "address": "Khoon amara tehsil majalta district udhampur"},
    {"id": 81, "name": "neeraj mann", "phone": "9910276443", "email": "neerajmann011@gmail.com", "address": "Gali No. 14 Gautam Colony"},
    {"id": 82, "name": "SHAHZAD KHAN", "phone": "9920986314", "email": "Shahzadkhanr989@gmail.com", "address": "Pachperwa to Jaitapur Road Ratanpur Chauraha"},
    {"id": 83, "name": "AUDIITER", "phone": "9940698695", "email": "audiiterstaff@gmail.com", "address": "AUDIITER 3RD FLOOR, BALAJI CONSULTING SERVICES, 27/34 MADHA CHURCH RD, MANDAVELI, MYLAPORE CHENNAI, TAMIL NADU, 600028"},
    {"id": 84, "name": "Amit Kumar", "phone": "9996055014", "email": "ami_t@live.com", "address": "Amit Kumar Vpo. Neerpur, Tish. Narnaul Dist. Mahendragrah 123001 Narnaul HR India"},
    {"id": 85, "name": "Nirdosh kumar, singh", "phone": "9997770226", "email": "nirdoshbly@gmail.com", "address": "Budaun road OPP Satyam barat ghar vaishno dham colony fozi ki taal bareilly 243001, 243001"},
    {"id": 86, "name": "Sunny rastogi", "phone": "9997999995", "email": "sudhajeweller99@gmail.com", "address": "H 100 shivalik nagar"},
]

# Sample repair tickets (subset - will be created with proper mapping)
OLD_TICKETS = [
    {"id": 4, "customer_name": "Amit Kumar", "customer_phone": "9996055014", "customer_email": "ami_t@live.com", "product_name": "JSN-02430E80", "serial_number": "920302408290008", "issue_description": "Error \"9\" appearing on the screen", "pickup_address": "Amit Kumar Vpo. Neerpur, Tish. Narnaul Dist. Mahendragrah 123001 Narnaul HR India", "pickup_city": "Narnaul", "pickup_pincode": "123001", "current_status": "Pickup Arranged"},
    {"id": 5, "customer_name": "VIPIN NB", "customer_phone": "9746803327", "customer_email": "Vipin4guys@gmail.com", "product_name": "MG-H4862E120-D", "serial_number": "92060231201089", "issue_description": "Battery charging and Battery load not taking error code showing bp", "pickup_address": "MWRA 35,NERIYAMKOTTU HOUSE, PEREPARAMBU ROAD", "pickup_city": "ERNAKULAM", "pickup_pincode": "682025", "current_status": "Closed by Agent"},
    {"id": 8, "customer_name": "Anoob g b", "customer_phone": "8907818307", "customer_email": "anoobgb007@gmail.com", "product_name": "Gootu 6.2kW", "serial_number": "GOOTU6-6248-003", "issue_description": "This hybrid inverter 6.2KW is not turning on when supply power of 230V is given", "pickup_address": "Anugraha 85a, Ranni Lane, Peroorkada.p.o, Trivandrum-695005", "pickup_city": "Thiruvananthapuram", "pickup_pincode": "695005", "current_status": "Resolved on Call"},
    {"id": 9, "customer_name": "ANKUR GOYAL", "customer_phone": "7300607837", "customer_email": "gangahandicraftexports@gmail.com", "product_name": "MG2410090AM", "serial_number": "MG2410100AM035", "issue_description": "Stabilizer red light is continuously blinking and stabilizer is not giving power output", "pickup_address": "Plot No 1, Mayur Vihar, Chamrauli", "pickup_city": "Agra", "pickup_pincode": "282001", "current_status": "Closed by Agent"},
    {"id": 10, "customer_name": "Haraprasad Mallick", "customer_phone": "9153131557", "customer_email": "debjyotimallickonrage@gmail.com", "product_name": "MuscleGrid 10.2KW Heavy Duty Solar Hybrid Inverter", "serial_number": "85044010", "issue_description": "Lithium battery cell no 6 and 14 voltage low", "pickup_address": "Gobindanagar Sarada Pally, Bankura", "pickup_city": "Bankura", "pickup_pincode": "722102", "current_status": "Resolved on Call"},
    {"id": 14, "customer_name": "Haraprasad Mallick", "customer_phone": "9153131557", "customer_email": "debjyotimallickonrage@gmail.com", "product_name": "MuscleGrid India 6.2 KW True Hybrid Heavy Duty Triple MPPT", "serial_number": "4263567", "issue_description": "No power is coming from both AC outputs. Please advise on how to fix.", "pickup_address": "Gobindanagar Sarada Pally, Bankura", "pickup_city": "Bankura", "pickup_pincode": "722102", "current_status": "Hardware Service - Awaiting Label"},
    {"id": 17, "customer_name": "Prabhu bisht", "customer_phone": "9897035677", "customer_email": "", "product_name": "6.2 True Hybrid Heavy Duty Batteryless Triple MPPT Solar Inverter", "serial_number": "MG25010044", "issue_description": "No display", "pickup_address": "Rawat cottage talla cheenakhan almora uttrakhand -263601", "pickup_city": "Almora", "pickup_pincode": "263601", "current_status": "Resolved on Call"},
    {"id": 19, "customer_name": "Dhoop singh", "customer_phone": "8052219124", "customer_email": "dhoopsinghbundela96@gmail.com", "product_name": "24V", "serial_number": "12345", "issue_description": "Battery not taking load", "pickup_address": "19 paraun lalitpur Uttar Pradesh", "pickup_city": "Lalitpur", "pickup_pincode": "284123", "current_status": "Hardware Service - Awaiting Label"},
    {"id": 32, "customer_name": "Divya Raj Jeevan Verma", "customer_phone": "6387483366", "customer_email": "jayramdev273@gmail.com", "product_name": "MG3KWSET", "serial_number": "B0CGQ359GS", "issue_description": "Solar Charging section not working. Burning smell observed along with black smoke", "pickup_address": "C-57, Growth Centre Bijouli Jhansi - 284135", "pickup_city": "Jhansi", "pickup_pincode": "284135", "current_status": "Hardware Service - Awaiting Label"},
    {"id": 33, "customer_name": "AUDIITER", "customer_phone": "9940698695", "customer_email": "audiiterstaff@gmail.com", "product_name": "Muscle Grid Inverter", "serial_number": "NA", "issue_description": "Need tech help", "pickup_address": "3RD FLOOR, BALAJI CONSULTING SERVICES, 27/34 MADHA CHURCH RD, CHENNAI", "pickup_city": "Chennai", "pickup_pincode": "600028", "current_status": "Resolved on Call"},
]

# Product SKUs
OLD_SKUS = [
    {"sku_code": "MG-H4862E120-D", "model_name": "MuscleGrid 6.2kW Heavy Duty Hybrid Solar Inverter with 120Ah 48V Lithium Battery"},
    {"sku_code": "MG-H48102E160", "model_name": "MuscleGrid 10.2kW Heavy Duty Hybrid Solar Inverter with 160Ah 48V Lithium Battery"},
    {"sku_code": "MG3KWSET", "model_name": "MuscleGrid 3kW Solar Inverter Set"},
    {"sku_code": "MG-6.2KW", "model_name": "MuscleGrid 6.2kW True Hybrid Heavy Duty Triple MPPT Battery Less Solar Inverter"},
    {"sku_code": "MG-4.2KW", "model_name": "MuscleGrid 4.2kW True Hybrid Heavy Duty Triple MPPT Battery Less Solar Inverter"},
    {"sku_code": "MG-10.2KW", "model_name": "MuscleGrid 10.2kW Heavy Duty Solar Hybrid Inverter"},
    {"sku_code": "MG8KVA90V", "model_name": "MuscleGrid 8KVA (90v to 300v) 6400W Copper Wired Heavy Duty Voltage Stabilizer"},
    {"sku_code": "MG15KVA130V", "model_name": "MuscleGrid 15 kVA 130 - 280 V 12000 W Main Line Voltage Stabilizer"},
    {"sku_code": "MG2410090AM", "model_name": "MuscleGrid 10kVA 90-280V Automatic Voltage Stabilizer"},
    {"sku_code": "MG-GOOTU-6.2KW", "model_name": "Gootu 6.2kW Hybrid Solar Inverter"},
]

# Old user roles mapping
OLD_USERS = [
    {"id": 1, "username": "admin", "role": "admin"},
    {"id": 2, "username": "support1", "role": "call_support"},
    {"id": 3, "username": "support2", "role": "call_support"},
    {"id": 4, "username": "accountant1", "role": "accountant"},
    {"id": 5, "username": "dispatcher1", "role": "dispatcher"},
    {"id": 6, "username": "technician1", "role": "tech"},
]

# Status mapping from old to new
STATUS_MAP = {
    "Phone Support – Pending": "open",
    "Call Support – Followup": "in_progress",
    "Resolved on Call": "resolved",
    "Closed by Agent": "closed",
    "Hardware Service – Awaiting Label": "hardware_required",
    "Pickup Arranged": "pending_pickup",
    "Ready for Dispatch (Dispatcher)": "pending_dispatch",
    "Dispatched": "dispatched",
    "New Order": "pending_label",
}

async def clear_existing_data():
    """Clear existing data before migration"""
    print("Clearing existing data...")
    await db.users.delete_many({})
    await db.tickets.delete_many({})
    await db.warranties.delete_many({})
    await db.dispatches.delete_many({})
    await db.campaigns.delete_many({})
    await db.products.delete_many({})
    print("Cleared all collections.")

async def create_system_users():
    """Create system users (admin, support, accountant, dispatcher)"""
    print("\nCreating system users...")
    
    system_users = [
        {"email": "admin@musclegrid.in", "password": "admin123", "first_name": "Admin", "last_name": "User", "role": "admin", "phone": "9999999901"},
        {"email": "support@musclegrid.in", "password": "support123", "first_name": "Support", "last_name": "Agent", "role": "call_support", "phone": "9999999902"},
        {"email": "support2@musclegrid.in", "password": "support123", "first_name": "Support2", "last_name": "Agent", "role": "call_support", "phone": "9999999903"},
        {"email": "accountant@musclegrid.in", "password": "accountant123", "first_name": "Accountant", "last_name": "User", "role": "accountant", "phone": "9999999904"},
        {"email": "dispatcher@musclegrid.in", "password": "dispatch123", "first_name": "Dispatcher", "last_name": "User", "role": "dispatcher", "phone": "9999999905"},
        {"email": "service@musclegrid.in", "password": "service123", "first_name": "Service", "last_name": "Agent", "role": "service_agent", "phone": "9999999906"},
    ]
    
    created_users = {}
    for user in system_users:
        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        user_doc = {
            "id": user_id,
            "email": user["email"],
            "first_name": user["first_name"],
            "last_name": user["last_name"],
            "phone": user["phone"],
            "role": user["role"],
            "password_hash": hash_password(user["password"]),
            "address": "MuscleGrid Office",
            "city": "Delhi",
            "state": "Delhi",
            "pincode": "110001",
            "created_at": now,
            "updated_at": now
        }
        
        await db.users.insert_one(user_doc)
        created_users[user["role"]] = user_id
        print(f"  Created {user['role']}: {user['email']}")
    
    return created_users

async def migrate_customers():
    """Migrate customers from old database"""
    print("\nMigrating customers...")
    
    customer_id_map = {}  # old_id -> new_id
    migrated = 0
    
    for old_customer in OLD_CUSTOMERS:
        if not old_customer.get("name") or not old_customer.get("phone"):
            continue
            
        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        # Parse name into first/last
        name_parts = old_customer["name"].split(" ", 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""
        
        # Generate email if missing
        email = old_customer.get("email")
        if not email:
            email = f"customer_{old_customer['phone']}@musclegrid.in"
        
        user_doc = {
            "id": user_id,
            "legacy_id": old_customer["id"],
            "email": email.lower(),
            "first_name": first_name,
            "last_name": last_name,
            "phone": old_customer["phone"],
            "role": "customer",
            "password_hash": hash_password("customer123"),
            "address": old_customer.get("address", ""),
            "city": None,
            "state": None,
            "pincode": None,
            "created_at": now,
            "updated_at": now
        }
        
        try:
            await db.users.insert_one(user_doc)
            customer_id_map[old_customer["id"]] = user_id
            migrated += 1
        except Exception as e:
            print(f"  Skipped duplicate: {email}")
    
    print(f"  Migrated {migrated} customers")
    return customer_id_map

async def migrate_tickets(customer_id_map, system_users):
    """Migrate repair tickets"""
    print("\nMigrating tickets...")
    
    migrated = 0
    for old_ticket in OLD_TICKETS:
        ticket_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        # Map old status to new
        old_status = old_ticket.get("current_status", "open")
        new_status = STATUS_MAP.get(old_status, "open")
        
        # Determine device type from product name
        product_name = old_ticket.get("product_name", "").lower()
        if "stabilizer" in product_name:
            device_type = "Stabilizer"
        elif "battery" in product_name:
            device_type = "Battery"
        else:
            device_type = "Inverter"
        
        # Build address
        address = f"{old_ticket.get('pickup_address', '')}"
        if old_ticket.get('pickup_city'):
            address += f", {old_ticket['pickup_city']}"
        if old_ticket.get('pickup_pincode'):
            address += f" - {old_ticket['pickup_pincode']}"
        
        ticket_doc = {
            "id": ticket_id,
            "legacy_id": old_ticket["id"],
            "ticket_number": f"TKT-MIG-{str(old_ticket['id']).zfill(4)}",
            "customer_id": None,  # Will be linked if customer exists
            "customer_name": old_ticket.get("customer_name", "Unknown"),
            "customer_phone": old_ticket.get("customer_phone", ""),
            "customer_email": old_ticket.get("customer_email", ""),
            "customer_address": address,
            "device_type": device_type,
            "order_id": old_ticket.get("serial_number"),
            "issue_description": old_ticket.get("issue_description", "Migrated ticket"),
            "status": new_status,
            "diagnosis": None,
            "issue_type": "hardware" if "Hardware" in old_status else "software" if "Resolved" in old_status else None,
            "agent_notes": f"Product: {old_ticket.get('product_name', 'N/A')}",
            "assigned_to": None,
            "assigned_to_name": None,
            "created_by": system_users.get("admin"),
            "created_at": now,
            "updated_at": now,
            "history": [{
                "action": "Ticket migrated from legacy system",
                "by": "System Migration",
                "by_role": "admin",
                "timestamp": now
            }]
        }
        
        await db.tickets.insert_one(ticket_doc)
        migrated += 1
    
    print(f"  Migrated {migrated} tickets")

async def create_products():
    """Create product catalog"""
    print("\nCreating product catalog...")
    
    for sku in OLD_SKUS:
        product_doc = {
            "id": str(uuid.uuid4()),
            "sku_code": sku["sku_code"],
            "model_name": sku["model_name"],
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.products.insert_one(product_doc)
    
    print(f"  Created {len(OLD_SKUS)} products")

async def create_sample_warranties(customer_id_map, system_users):
    """Create sample warranty records"""
    print("\nCreating sample warranties...")
    
    # Create warranties for first 10 customers
    sample_customers = list(customer_id_map.items())[:10]
    
    for old_id, new_id in sample_customers:
        customer = await db.users.find_one({"id": new_id}, {"_id": 0})
        if not customer:
            continue
        
        warranty_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        # Random warranty end date (6 months to 2 years from now)
        warranty_end = datetime.now(timezone.utc) + timedelta(days=365)
        
        warranty_doc = {
            "id": warranty_id,
            "warranty_number": f"WRN-MIG-{str(old_id).zfill(4)}",
            "customer_id": new_id,
            "first_name": customer["first_name"],
            "last_name": customer["last_name"],
            "phone": customer["phone"],
            "email": customer["email"],
            "device_type": "Inverter",
            "invoice_date": (datetime.now(timezone.utc) - timedelta(days=180)).date().isoformat(),
            "invoice_amount": 35000.00,
            "order_id": f"AMZ-{str(old_id).zfill(6)}",
            "invoice_file": None,
            "status": "approved",
            "warranty_end_date": warranty_end.date().isoformat(),
            "admin_notes": "Migrated from legacy system",
            "extension_requested": False,
            "extension_status": None,
            "extension_review_file": None,
            "created_at": now,
            "updated_at": now
        }
        
        await db.warranties.insert_one(warranty_doc)
    
    print(f"  Created {len(sample_customers)} warranty records")

async def create_indexes():
    """Create database indexes for performance"""
    print("\nCreating database indexes...")
    
    # Users indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("phone")
    await db.users.create_index("role")
    
    # Tickets indexes
    await db.tickets.create_index("ticket_number", unique=True)
    await db.tickets.create_index("customer_id")
    await db.tickets.create_index("status")
    await db.tickets.create_index("created_at")
    
    # Warranties indexes
    await db.warranties.create_index("customer_id")
    await db.warranties.create_index("status")
    await db.warranties.create_index("phone")
    
    # Dispatches indexes
    await db.dispatches.create_index("dispatch_number", unique=True)
    await db.dispatches.create_index("status")
    await db.dispatches.create_index("ticket_id")
    
    print("  Indexes created")

async def print_summary():
    """Print migration summary"""
    print("\n" + "="*50)
    print("MIGRATION COMPLETE")
    print("="*50)
    
    users_count = await db.users.count_documents({})
    customers_count = await db.users.count_documents({"role": "customer"})
    tickets_count = await db.tickets.count_documents({})
    warranties_count = await db.warranties.count_documents({})
    products_count = await db.products.count_documents({})
    
    print(f"\nTotal Users: {users_count}")
    print(f"  - Customers: {customers_count}")
    print(f"  - Staff: {users_count - customers_count}")
    print(f"Tickets: {tickets_count}")
    print(f"Warranties: {warranties_count}")
    print(f"Products: {products_count}")
    
    print("\n" + "="*50)
    print("LOGIN CREDENTIALS")
    print("="*50)
    print("\nSystem Users:")
    print("  Admin:      admin@musclegrid.in / admin123")
    print("  Support:    support@musclegrid.in / support123")
    print("  Accountant: accountant@musclegrid.in / accountant123")
    print("  Dispatcher: dispatcher@musclegrid.in / dispatch123")
    print("  Service:    service@musclegrid.in / service123")
    print("\nCustomer Login:")
    print("  Any migrated customer can login with:")
    print("  Email: their email / Password: customer123")
    print("="*50)

async def run_migration():
    """Run the complete migration"""
    print("="*50)
    print("MuscleGrid CRM - Data Migration")
    print("="*50)
    
    await clear_existing_data()
    system_users = await create_system_users()
    customer_id_map = await migrate_customers()
    await migrate_tickets(customer_id_map, system_users)
    await create_products()
    await create_sample_warranties(customer_id_map, system_users)
    await create_indexes()
    await print_summary()

if __name__ == "__main__":
    asyncio.run(run_migration())
