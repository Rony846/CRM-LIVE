-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Mar 27, 2026 at 12:55 PM
-- Server version: 11.8.6-MariaDB-log
-- PHP Version: 7.2.34

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `u713296379_partners`
--

-- --------------------------------------------------------

--
-- Table structure for table `dealers`
--

CREATE TABLE `dealers` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `firm_name` varchar(255) NOT NULL,
  `contact_person` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `gst_number` varchar(50) DEFAULT NULL,
  `address_line1` varchar(255) DEFAULT NULL,
  `address_line2` varchar(255) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `district` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT 'Uttar Pradesh',
  `pincode` varchar(20) DEFAULT NULL,
  `status` enum('pending','approved','rejected','suspended') NOT NULL DEFAULT 'pending',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `security_deposit_amount` decimal(10,2) NOT NULL DEFAULT 100000.00,
  `security_deposit_status` enum('not_paid','pending','approved','rejected') NOT NULL DEFAULT 'not_paid',
  `security_deposit_proof_path` varchar(255) DEFAULT NULL,
  `security_deposit_uploaded_at` datetime DEFAULT NULL,
  `security_deposit_approved_at` datetime DEFAULT NULL,
  `security_deposit_remarks` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `dealers`
--

INSERT INTO `dealers` (`id`, `user_id`, `firm_name`, `contact_person`, `phone`, `gst_number`, `address_line1`, `address_line2`, `city`, `district`, `state`, `pincode`, `status`, `created_at`, `security_deposit_amount`, `security_deposit_status`, `security_deposit_proof_path`, `security_deposit_uploaded_at`, `security_deposit_approved_at`, `security_deposit_remarks`) VALUES
(2, 3, 'ABC', 'abx', '9800006416', '07BLDPR5944R3Z1', 'Plot No. 213 VISHWAKARMA INDUSTRIAL ESTATE PANCHLI KHURD', '', 'Meerut', 'MEERUT', 'Uttar Pradesh', '250002', 'approved', '2025-12-14 00:45:24', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(3, 4, 'Deepak shinde', '8431809797', '9844988541', '', 'Hulsoor road Basavakalyan', 'Near rajkumar hotel hulsoor road Basavakalyan dist bidar Karnataka', 'Basavakalyan', 'Bidar', 'Karnataka', '585327', 'approved', '2025-12-16 12:37:29', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(4, 5, 'AUDIITER', '9445543407', '9445543407', '33AALTA8703H1ZR', 'Thatchi Arunachalam Street Mylapore', '', 'Chennai', 'Chennai', 'Tamil Nadu', '600004', 'approved', '2025-12-28 10:44:41', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(5, 6, 'AUDIITER', 'AUDIITER', '9940698695', '33AALTA8703H1ZR', 'Bright Trades Audiiter Turning Point, New No.25/2; Old No.13/2, Ground Floor, New Street', 'Chennai', 'CHENNAI', 'Chennai', 'Tamil Nadu', '600004', 'rejected', '2025-12-28 10:44:47', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(6, 7, 'Om Envision Enterprises', 'Vinod Kumar', '9992414242', '06AUSPK5819M1ZW', 'Village-Dhatir, Near Daya Garden, Dist-Palwal, Haryana-121102', '', 'Palwal', 'Palwal', 'Haryana', '121102', 'approved', '2026-01-07 09:30:20', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(7, 8, 'Bernard & Singpu', 'Bernard Kamliansanga', '7629971576', NULL, 'Vengthar', 'Near Cemetery', 'Champhai', 'Champhai', 'Mizoram', '796321', 'approved', '2026-01-07 09:30:24', 100000.00, 'approved', '/uploads/security_deposits/dealer_7/DEP_7_20260129_051849_697aedb9a5a50.jpeg', NULL, '2026-01-29 07:59:48', ''),
(8, 9, 'Primegrid Power Private Limited', 'Javed Ali', '9557050900', '09AAQCP1916R1ZJ', 'WSA-151, B-128 First Floor', 'Sector 2', 'Noida', 'Gautam Buddha Nagar', 'Uttar Pradesh', '201301', 'approved', '2026-01-07 09:30:27', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(9, 10, 'SOLAR PV POWER SOLUTION PRIVATE LIMITED', 'Aman Jain', '9039030606', NULL, '158 Bardan Mandi', 'Palda', 'Indore', 'Indore', 'Madhya Pradesh', '452020', 'approved', '2026-01-16 07:37:05', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(10, 11, 'JDMP Tech Private Limited', 'Mukhjit singh', '9270532195', '27AAECJ1579N1Z0', 'Plot no. 507, Southcity, Cidco Mahanagar-2,', 'Chh. Sambhajinagar', 'Chh. Sambhajinagar', 'Chh. Sambhajinagar', 'Maharashtra', '431136', 'approved', '2026-01-20 07:51:24', 100000.00, 'approved', '/uploads/security_deposits/dealer_10/DEP_10_20260124_173525_697502dd9b6b7.pdf', NULL, '2026-01-27 08:55:17', ''),
(11, 12, 'Royal Enterprises', 'Vishesh Kumar Yadav', '9416118467', NULL, '1st Floor, Hotel Rao State', 'near bsnl Exchange', 'Narnaul', 'Mohindergarh', 'Haryana', '123001', 'approved', '2026-01-20 07:51:30', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(12, 13, 'Manoj Kumar', 'Jeevan group Enterprise', '9519423350', '09CTRPK5222N1Z0', 'Uttar Pradesh', 'Khutar Shahjahanpur', 'Khutar', 'Shahjahanpur', 'Uttar Pradesh', '242405', 'pending', '2026-01-21 06:24:57', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(13, 14, 'GYK Solutions', 'Narender Singh', '9050339839', NULL, 'Shop no 21 , silani mandkola road', 'Silani chauk', 'Sohna', 'Gurgaon', 'Haryana', '122103', 'pending', '2026-01-21 07:22:35', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(14, 15, 'GANIYAR SOLAR POWER', 'SANJIT KUMAR', '9416282457', NULL, 'CHANPURA GANIYAR ROAD NEAR GURUKUL', 'VPO GANIYAR', 'GANIYAR', 'MAHENDER GARH', 'HARYANA', '123021', 'approved', '2026-01-23 05:10:30', 100000.00, 'approved', '/uploads/security_deposits/dealer_14/DEP_14_20260128_133912_697a1180b61da.pdf', NULL, '2026-01-29 07:59:53', ''),
(15, 16, 'M M enterprises', 'Sumit Kumar Dubey', '9565599939', NULL, 'Belauna Machlisahar jaunpur', 'Belauna Machlisahar jaunpur', 'Jaunpur', 'Jaunpur', 'Uttar Pradesh', '222001', 'pending', '2026-01-24 07:20:11', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(16, 17, 'SHRI RADHA KRISHNA SOLAR & ELECTRICALS', 'VIMLESH KUMAR SAINI', '9664155912', '08IXHPS6725Q1ZA', '09', ', Sita Vatika Aamli Mod', 'Sawai Madhopur', 'Sawai Madhopur', 'Rajasthan ( 08 )', '322021', 'pending', '2026-01-24 07:20:47', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(17, 18, 'Shiv Shakti Solar Energy', 'Rakesh Kumar', '6378758636', NULL, 'shop no 2 , om tower , near bawari gate , fatehpur shekhawati , sikar  , rajasthan 332301', '', 'fatehpur shekhawati', 'sikar', 'rajasthan', '332301', 'pending', '2026-01-24 09:41:58', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(18, 19, 'Dayrays technologies pvt ltd', 'Yasir Puthukudi', '9633336009', NULL, 'NH JUNCTION CHANGUVETTY KOTTAKKAL', '', 'Kottakkal', 'Malappuram', 'Kerala', '676501', 'pending', '2026-01-24 10:50:47', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(19, 20, 'SHRESTH SOLAR AND ELECTRICAL ENTERPRISES', 'Rakesh Kumar tiwari', '8576943452', NULL, 'Kashipur mohan hathigawa Kunda pratapgarh uttar pradesh', '', '', 'Pratapgarh', 'Uttar Pradesh', '230201', 'pending', '2026-01-24 10:50:51', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(20, 21, 'Zinam valley power pvt ltd', 'Asab Uddin', '9101708036', NULL, '', '', '', '', 'Assam', '782446', 'approved', '2026-01-28 08:27:32', 100000.00, 'approved', '/uploads/security_deposits/dealer_20/DEP_20_20260203_080024_6981ab183d7aa.pdf', NULL, '2026-02-03 08:01:55', ''),
(21, 22, 'Kavita Praveen Kymar', 'Praveen kumar Gehlot', '9828844001', NULL, '70J, Mohan Niwas , Ganga Vihar , Opp SBI Bank', 'Sector 2 , Kuri Bhagtasni Housing Board , Basni I', 'JODHPUR', 'JODH0UR', 'Rajasthan', '342005', 'pending', '2026-01-30 08:33:36', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(22, 23, 'NAVEEN BEST ELECTRONICS', 'Gnanaprakasam Kandhasamy', '9842744824', NULL, '5/143 chinnagounder thottam', 'Andagaloor Gate', 'Rasipuram', 'NAMAKKAL', 'Tamil Nadu', '637401', 'pending', '2026-02-04 10:09:51', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(23, 24, 'Harsh enterprise', 'Tejveer singh', '9675591591', NULL, 'Akbarpur gonda road aligarh', '', 'Aligarh', 'Aligarh', 'Uttar pradesh', '202002', 'pending', '2026-02-04 10:09:54', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(24, 25, 'GT green technology', 'Tikam patel', '7000106618', NULL, 'Guniyadipa bhikapali  post patharala', '', 'Basna', 'Mahasamund', 'Chhattisgarh', '493555', 'pending', '2026-02-07 05:57:44', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(25, 26, 'Shri Shyam Sales Corporation', 'Jay Kumar Goyal', '9672283829', NULL, 'Shop No. 14', 'Opp. Aggersain Dharmshala', 'Nohar', 'Hanumangarh', 'Rajasthan', '335523', 'pending', '2026-02-08 11:48:09', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(26, 27, 'Mahalaxmi electronics and furniture', 'ram pratap godara', '7791894691', NULL, 'lalgarh road', 'katar chhoti', 'katar', 'churu', 'rajasthan', '331517', 'pending', '2026-02-09 05:23:55', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(27, 28, 'Avigna Electricals', 'Nanjundaiah R', '6362717714', NULL, 'No 89-A, 12th Main Road, pipeline road,Near Anniebesant school,', 'Sreenivas Nagar,  sunkadkate, BENGALURU,  Karnataka 560091', 'Bengaluru', 'Bengaluru', 'Karnataka', '560091', 'pending', '2026-02-09 06:33:51', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(28, 29, 'Tefinsol Solar World', 'Satpal Singh Kajla', '9888540245', NULL, 'Jaja Road Adda Jhawan VPO Jhawan', '', 'Tanda Urmar, (HOSHIARPUR)', 'Hoshiarpur', 'Punjab', '144212', 'pending', '2026-02-09 08:30:06', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(29, 30, 'Hayat solar & eng works', 'Mohammad hayat', '7992091298', NULL, 'Hainsi jaichandra Sadar pratapgarh', 'Mauaima paryagraj', 'Paryagraj', 'Paryagraj', 'Uttarpradesh', '212587', 'pending', '2026-02-10 05:18:44', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(30, 31, 'Alak Debbarma', '9612680103', '9612680103', NULL, 'Kathal Bagan, Gourkha basti', 'Green Heritage complex', 'Agartala', 'West Tripura', 'Tripura', '799006', 'approved', '2026-02-10 05:19:16', 100000.00, 'approved', NULL, NULL, '2026-02-14 05:55:02', ''),
(31, 32, 'AZLAN POWER SOLUTIONS', 'MOHD HASAN KHAN', '8430441482', NULL, 'House no 114 vill and post singan khera teh sadar', 'Rampur Uttar Pradesh', 'Rampur', 'Rampur', 'Uttar Pradesh', '244927', 'approved', '2026-02-10 12:05:26', 100000.00, '', '/uploads/security_deposits/dealer_31/DEP_31_20260307_112541_69ac0b35ef327.pdf', NULL, NULL, NULL),
(32, 33, 'Ayansh Infotech Private Limited', 'Manoj Kumar', '9304220886', NULL, '5th Floor, Nilam Complex, Harisabha Road', 'Ramna', 'Muzaffarpur', 'Muzaffarpur', 'Bihar', '842002', 'pending', '2026-02-12 06:08:16', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(33, 34, 'Chaudhary Electricals', 'Vijay choudhary', '8884147374', NULL, 'Naveen Galla Mondi Etah Rode', 'Tundla', 'Tundla', 'Tundla', 'Uttar Pradesh', '283204', 'pending', '2026-02-12 08:38:59', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(34, 35, 'Mambo Distributors', 'Prince Bansal', '9888000001', NULL, 'PH-8, FOCAL POINT, MANGLI', '', 'Ludhiana', 'Ludhiana', 'PUNJAB', '141010', 'pending', '2026-02-14 05:43:41', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(35, 36, 'shubham', 'shubham', '9568898424', NULL, 'behjoi road chandausi', '', 'chandausi', 'sambhal', 'uttar pradesh', '244412', 'pending', '2026-02-19 06:01:47', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(36, 37, 'solartec enterprises', 'Ravichandra Swami', '9110897771', NULL, '28, swami nivas, opp water tank, bidar road, bank colony, hallikhed (B)', '', 'humnabad', 'bidar', 'karnataka', '585414', 'pending', '2026-02-19 06:01:56', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(37, 38, 'S.K Computer Services and Electricals', 'Santosh Khaire', '7218070450', NULL, 'AT.Khairewadi Po. Kanhur Mesai Tal.Shirur Dist. Pune', '', 'Shirur', 'Pune', 'Maharashtra', '412218', 'approved', '2026-02-21 05:26:38', 100000.00, 'approved', '/uploads/security_deposits/dealer_37/DEP_37_20260316_053627_69b796dbc64cd.jpeg', NULL, '2026-03-16 06:44:28', ''),
(38, 39, 'NRG Infra Netzero Private Limited', 'Mahan Hansraj', '7509330933', NULL, '', '', '', '', 'Uttar Pradesh', '201311', 'pending', '2026-02-25 05:10:54', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(39, 40, 'Ebad', '9897055000', '9837869888', NULL, '183-Miya Sarai, Khari Kuan, Nawabo Wali Masjid,', '', 'Sambhal', 'Sambhal', 'Uttar Pradesh', '244302', 'pending', '2026-02-25 13:48:39', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(40, 41, 'Vedika Power', 'Dilip Kumar Singh', '8638454043', NULL, 'Bhitorsuti, Kaliabhomora', 'No 1 Dolabari', 'Tezpur', 'Sonitpur', 'Assam', '784027', 'approved', '2026-02-26 05:59:32', 100000.00, 'approved', NULL, NULL, '2026-03-26 10:13:09', ''),
(41, 42, 'Future electronics', 'Mohit jain', '9582371579', NULL, 'Office 49 chandan hulla fatepure beri new delhi', '', 'New delhi', 'Delhi', 'New delhi', '110074', 'pending', '2026-03-03 06:25:55', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(42, 43, 'Long step power technology pvt ltd', 'Sanjay Kumar', '8708513389', NULL, 'Vishnu colony,Near Vishnu mandir, railway road', '', 'Mahendergarh', 'Mahendergarh', 'Haryana', '123029', 'pending', '2026-03-03 06:25:58', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(43, 44, 'UP TECH ENTERPRISES', 'ALIM ZAIDI', '8909323236', NULL, 'FIRST FLOOR WARD 2 MUSTARK', 'NEAR THANA MIRANPUR', 'Muzaffarnagar', 'Muzaffarnagar', 'Uttar Pradesh ( 09 )', '251315', 'pending', '2026-03-05 09:31:49', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(44, 45, 'DIKSHIT AQUA', 'GAURAV TYAGI', '7011142030', NULL, 'A1/1 DEDHA MARKET KHICHRIPUR DELHI', 'G-42 1ST FLOOR SEC-9 NOIDA', 'NOIDA', 'GAUTAM BUDDH NAGAR', 'UTTAR PRADESH', '201301', 'pending', '2026-03-07 06:46:06', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(45, 46, 'Swapnpurti enterprises', 'Dipak Wagaj', '9518527107', NULL, 'At.post-Shetphal  pin.code-413324', '-', 'Shetphal', 'Solapur', 'Maharashtra', '413324', 'pending', '2026-03-09 06:36:59', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(46, 47, 'vivek kumar maurya', '8299548267', '8299548267', NULL, 'vill and post sikanderpur distic-ambedkarnagar up224186', '', 'akbarpur', 'ambedkarnagar', 'utter pardesh', '224122', 'pending', '2026-03-14 06:22:35', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(47, 48, 'Bhati Enterprises', 'Rahul bhati', '9548359974', NULL, 'Village Falaida teh jewar', '', 'Greater noida', 'Gautam budhh nagar', 'Uttar pradesh', '203135', 'approved', '2026-03-14 06:52:56', 100000.00, 'approved', NULL, NULL, '2026-03-16 06:49:46', ''),
(48, 49, 'Komesh choudhary', 'Karishna paower system', '9412625655', NULL, 'Shop No 01,Lalit Kumar Building,SH 51, CHANDAWLI, SAMBHAL', '', 'Sambhal', 'Sambhal', 'U P', '244302', 'pending', '2026-03-16 06:06:46', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(49, 50, 'Aditya Energy', 'Bhagirathi Pattajoshi', '9337102557', NULL, '166-B, Mancheswar Industrial Estate,Bhubaneswar', '', 'Bhubaneswar', 'Khorda', 'Odisha', '751010', 'pending', '2026-03-18 06:49:10', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(50, 51, 'Bharat Business Deals', 'LALIT KUMAR AGRAWAL', '7000484146', NULL, 'Geet Siya, 32 Bangala Compound, Ashoka Ratan', 'Shankar Nagar Raipur Chhattisgarh', 'Raipur', 'Raipur', 'Chhattisgarh', '492004', 'pending', '2026-03-18 06:50:04', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(51, 52, 'Takdir singh', 'Amit', '9813212264', NULL, 'Khushi entertainment', 'ladwa road Pipli kurukshetra', 'Pipli', 'Kurukshetra', 'Haryana', '136131', 'pending', '2026-03-18 12:59:37', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(52, 53, 'Radhe Krishna electronics', 'Satish', '9728318242', NULL, 'Vpo Birohar dist jahjjar Haryana pin code 124106', 'Vpo Birohar dist jahjjar Haryana pin code 124106', 'Jahjjar', 'Jahjjar', 'Haryana', '124106', 'pending', '2026-03-18 12:59:45', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(53, 54, 'AANJANEY', 'Aanjaney', '9911309599', NULL, 'Aanjaney business services, 219, Rudra Aksha Ward 7 Brahman Para', 'Mohbhattha Road near Garden (flyover) Bemetara', 'Bemetara', 'Bemetara', 'Chhattisgarh', '491335', 'pending', '2026-03-20 08:56:51', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(54, 55, 'ANUPAM INNOVATIONS', 'ANUPAM SINGH', '9935227361', NULL, 'Khasra No. 301/1 Saidupur', 'Hanumanganj', 'Prayagraj', 'Prayagraj', 'Uttar Pradesh', '221505', 'pending', '2026-03-23 06:08:40', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(55, 56, 'Sigma cctv systems', 'Kulwinder singh', '9878688824', NULL, 'Kocher market', 'Model gram', 'Ludhiana', 'Ludhiana', 'Punjab', '141002', 'pending', '2026-03-23 07:28:15', 100000.00, 'not_paid', NULL, NULL, NULL, NULL),
(56, 57, 'V-Sun Traders and Marketing', 'Vivian Vincent', '9176213062', NULL, 'Perandoor Road, Near Thannikkal Junction', 'Elamakkara P. O, Kaloor, Ernakulam', 'Ernakulam', '', 'Kerala', '682026', 'pending', '2026-03-23 07:28:19', 100000.00, '', '/uploads/security_deposits/dealer_56/DEP_56_20260323_075107_69c0f0ebf2d10.png', NULL, NULL, NULL),
(57, 58, 'SUNJERSON', 'SYED MOHD SAIF', '9953036076', NULL, 'S7.125A GOLGHAR KACHAHRI  , VARANASI', '', '', '', 'UTTAR PRADESH', '221002', 'pending', '2026-03-25 06:30:39', 100000.00, 'not_paid', NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `dealer_agreement_acceptance`
--

CREATE TABLE `dealer_agreement_acceptance` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `dealer_id` int(11) DEFAULT NULL,
  `agreement_version` varchar(50) NOT NULL,
  `agreement_hash` varchar(64) NOT NULL,
  `accepted_at` datetime NOT NULL,
  `ip_address` varchar(64) NOT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- Dumping data for table `dealer_agreement_acceptance`
--

INSERT INTO `dealer_agreement_acceptance` (`id`, `user_id`, `dealer_id`, `agreement_version`, `agreement_hash`, `accepted_at`, `ip_address`, `user_agent`, `notes`) VALUES
(1, 2, 1, 'MG-DEALER-AGREEMENT-v1-2026-01-01', 'c8c1ca1c0d5ff660a876629fc3a05c3763e2ad55312152634a90fefc21eae557', '2026-01-01 19:48:13', '49.43.168.218', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', 'portal_accept');

-- --------------------------------------------------------

--
-- Table structure for table `dealer_applications`
--

CREATE TABLE `dealer_applications` (
  `id` int(11) NOT NULL,
  `firm_name` varchar(200) NOT NULL,
  `contact_person` varchar(150) NOT NULL,
  `email` varchar(150) NOT NULL,
  `mobile` varchar(20) NOT NULL,
  `address_line1` varchar(255) NOT NULL,
  `address_line2` varchar(255) DEFAULT NULL,
  `city` varchar(120) NOT NULL,
  `district` varchar(120) NOT NULL,
  `state` varchar(120) NOT NULL,
  `pincode` varchar(10) NOT NULL,
  `gstin` varchar(20) DEFAULT NULL,
  `business_type` varchar(80) DEFAULT NULL,
  `expected_monthly_volume` varchar(80) DEFAULT NULL,
  `primary_interest` varchar(80) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `pan_file` varchar(255) DEFAULT NULL,
  `gst_file` varchar(255) DEFAULT NULL,
  `shop_photo_file` varchar(255) DEFAULT NULL,
  `status` enum('new','review','approved','rejected') DEFAULT 'new',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `admin_notes` text DEFAULT NULL,
  `approved_user_id` int(11) DEFAULT NULL,
  `approved_dealer_id` int(11) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- Dumping data for table `dealer_applications`
--

INSERT INTO `dealer_applications` (`id`, `firm_name`, `contact_person`, `email`, `mobile`, `address_line1`, `address_line2`, `city`, `district`, `state`, `pincode`, `gstin`, `business_type`, `expected_monthly_volume`, `primary_interest`, `notes`, `pan_file`, `gst_file`, `shop_photo_file`, `status`, `created_at`, `admin_notes`, `approved_user_id`, `approved_dealer_id`, `updated_at`) VALUES
(1, 'ABC', 'abx', 'shweta@musclegrid.in', '9800006416', 'Plot No. 213 VISHWAKARMA INDUSTRIAL ESTATE PANCHLI KHURD', '', 'Meerut', 'MEERUT', 'Uttar Pradesh', '250002', '07BLDPR5944R3Z1', 'retailer', '2-5L', 'solar_inverters', '', NULL, NULL, NULL, 'approved', '2025-12-13 08:41:06', '', 3, 2, '2025-12-14 00:45:24'),
(2, 'Deepak shinde', '8431809797', 'laxmikantshinde54321@gmail.com', '9844988541', 'Hulsoor road Basavakalyan', 'Near rajkumar hotel hulsoor road Basavakalyan dist bidar Karnataka', 'Basavakalyan', 'Bidar', 'Karnataka', '585327', '', 'retailer', '0-2L', 'solar_inverters', 'Only inverter', NULL, NULL, NULL, 'approved', '2025-12-16 12:35:31', '', 4, 3, '2025-12-16 19:46:39'),
(3, 'AUDIITER', 'AUDIITER', 'audiiterstaff@gmail.com', '9940698695', 'Bright Trades Audiiter Turning Point, New No.25/2; Old No.13/2, Ground Floor, New Street', 'Chennai', 'CHENNAI', 'Chennai', 'Tamil Nadu', '600004', '33AALTA8703H1ZR', 'other', '0-2L', 'all', '', NULL, NULL, NULL, 'approved', '2025-12-26 08:25:05', '', 6, 5, '2025-12-28 10:44:47'),
(4, 'AUDIITER', '9445543407', 'brighttrades365@gmail.com', '9445543407', 'Thatchi Arunachalam Street Mylapore', '', 'Chennai', 'Chennai', 'Tamil Nadu', '600004', '33AALTA8703H1ZR', 'other', '0-2L', 'all', '', NULL, NULL, NULL, 'approved', '2025-12-27 04:50:14', '', 5, 4, '2025-12-28 10:44:41'),
(5, 'Pawan', 'Pawan Rathi', 'pawan846@outlook.com', '09560377363', '24 B2, FIRST FLOOR KHASRA 322', 'near tel mill neb sarai', 'New delhi', '', 'Delhi', '110068', '', 'other', '', 'all', '', NULL, NULL, NULL, 'rejected', '2025-12-27 20:08:56', '', NULL, NULL, '2025-12-28 10:44:56'),
(6, 'Primegrid Power Private Limited', 'Javed Ali', 'primegridpower@gmail.com', '9557050900', 'WSA-151, B-128 First Floor', 'Sector 2', 'Noida', 'Gautam Buddha Nagar', 'Uttar Pradesh', '201301', '09AAQCP1916R1ZJ', 'installer', '10L+', 'all', 'Hybrid solar Inverter and Lithium battrties', NULL, NULL, NULL, 'approved', '2025-12-29 11:11:19', '', 9, 8, '2026-01-07 09:30:27'),
(7, 'Bernard & Singpu', 'Bernard Kamliansanga', 'dksingpu3@gmail.com', '7629971576', 'Vengthar', 'Near Cemetery', 'Champhai', 'Champhai', 'Mizoram', '796321', '', 'retailer', '0-2L', 'all', '', NULL, NULL, NULL, 'approved', '2025-12-30 04:55:51', '', 8, 7, '2026-01-07 09:30:24'),
(8, 'Om Envision Enterprises', 'Vinod Kumar', 'rajeshsinghdagar@gmail.com', '9992414242', 'Village-Dhatir, Near Daya Garden, Dist-Palwal, Haryana-121102', '', 'Palwal', 'Palwal', 'Haryana', '121102', '06AUSPK5819M1ZW', 'other', '2-5L', 'all', '', NULL, NULL, NULL, 'approved', '2026-01-02 08:29:10', '', 7, 6, '2026-01-07 09:30:20'),
(9, 'SOLAR PV POWER SOLUTION PRIVATE LIMITED', 'Aman Jain', 'pvpowersolution@gmail.com', '9039030606', '158 Bardan Mandi', 'Palda', 'Indore', 'Indore', 'Madhya Pradesh', '452020', '23ABHCS3174Q1ZT', 'distributor', '5-10L', 'all', 'Kindly Respond', NULL, NULL, NULL, 'approved', '2026-01-09 09:13:41', '', 10, 9, '2026-01-16 07:37:05'),
(10, 'JDMP Tech Private Limited', 'Mukhjit singh', 'jdmptechpvtltd@gmail.com', '9270532195', 'Plot no. 507, Southcity, Cidco Mahanagar-2,', 'Chh. Sambhajinagar', 'Chh. Sambhajinagar', 'Chh. Sambhajinagar', 'Maharashtra', '431136', '27AAECJ1579N1Z0', 'other', '', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-01-19 07:40:22', '', 11, 10, '2026-01-20 07:51:24'),
(11, 'Royal Enterprises', 'Vishesh Kumar Yadav', 'royalitnnl@gmail.com', '9416118467', '1st Floor, Hotel Rao State', 'near bsnl Exchange', 'Narnaul', 'Mohindergarh', 'Haryana', '123001', '06AFFPY6907A1ZG', 'dealer', '10', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-01-19 11:44:26', '', 12, 11, '2026-01-20 07:51:30'),
(12, 'SHRI RADHA KRISHNA SOLAR & ELECTRICALS', 'VIMLESH KUMAR SAINI', 'vimleshsaini844@gmail.com', '9664155912', '09', ', Sita Vatika Aamli Mod', 'Sawai Madhopur', 'Sawai Madhopur', 'Rajasthan ( 08 )', '322021', '08IXHPS6725Q1ZA', 'dealer', '20', 'solar_inverter', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.\nI SOLAR VENDER IN PM SURYA GHAR YOJNA', NULL, NULL, NULL, 'approved', '2026-01-20 08:03:30', '', 17, 16, '2026-01-24 07:20:47'),
(13, 'Manoj Kumar', 'Jeevan group Enterprise', 'jeevangroupindia@gmail.com', '9519423350', 'Uttar Pradesh', 'Khutar Shahjahanpur', 'Khutar', 'Shahjahanpur', 'Uttar Pradesh', '242405', '09CTRPK5222N1Z0', 'dealer', '', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-01-20 12:20:00', '', 13, 12, '2026-01-21 06:24:57'),
(14, 'GYK Solutions', 'Narender Singh', 'nsdagarusd@gmail.com', '9050339839', 'Shop no 21 , silani mandkola road', 'Silani chauk', 'Sohna', 'Gurgaon', 'Haryana', '122103', '', 'retailer', '10', 'solar_inverter', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-01-21 07:13:09', '', 14, 13, '2026-01-21 07:22:35'),
(15, 'Rehman traders', 'Subhanur rehman', 'subhanurrehman4@gmail.com', '9717083788', 'Nakhsa hindu pura kheda sambhal uttar pradesh 244302', 'Near pakhad vaali masjid deepa sarai', 'Sambhal', 'Sambhal', 'Uttar Pradesh', '244302', '', 'dealer', '10 inverter per month', 'solar_inverter', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-01-22 07:09:11', '', NULL, NULL, '2026-01-22 11:40:40'),
(16, 'GANIYAR SOLAR POWER', 'SANJIT KUMAR', 'pawan4587@gmail.com', '9416282457', 'CHANPURA GANIYAR ROAD NEAR GURUKUL', 'VPO GANIYAR', 'GANIYAR', 'MAHENDER GARH', 'HARYANA', '123021', '', 'dealer', '5', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.\n20 YEAR EXPERIENCE DEAL IN INVERTER & BATTERY BUSINESS', NULL, NULL, NULL, 'approved', '2026-01-22 12:39:05', '', 15, 14, '2026-01-23 05:10:30'),
(17, 'M M enterprises', 'Sumit Kumar Dubey', 'sumitdubey1902@gmail.com', '9565599939', 'Belauna Machlisahar jaunpur', 'Belauna Machlisahar jaunpur', 'Jaunpur', 'Jaunpur', 'Uttar Pradesh', '222001', '', 'installer', '10inverters 20 battery', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-01-23 08:21:04', '', 16, 15, '2026-01-24 07:20:11'),
(18, 'Shiv Shakti Solar Energy', 'Rakesh Kumar', 'eurekafatehpur@gmail.com', '6378758636', 'shop no 2 , om tower , near bawari gate , fatehpur shekhawati , sikar  , rajasthan 332301', '', 'fatehpur shekhawati', 'sikar', 'rajasthan', '332301', '08BCPPK4400E1ZT', 'other', '20', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-01-24 08:12:16', '', 18, 17, '2026-01-24 09:41:58'),
(19, 'Dayrays technologies pvt ltd', 'Yasir Puthukudi', 'yasvly@gmail.com', '9633336009', 'NH JUNCTION CHANGUVETTY KOTTAKKAL', '', 'Kottakkal', 'Malappuram', 'Kerala', '676501', '', 'dealer', '25 inverters', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-01-24 09:51:02', '', 19, 18, '2026-01-24 10:50:47'),
(20, 'SHRESTH SOLAR AND ELECTRICAL ENTERPRISES', 'Rakesh Kumar tiwari', 'rakesh5996csc@gmail.com', '8576943452', 'Kashipur mohan hathigawa Kunda pratapgarh uttar pradesh', '', '', 'Pratapgarh', 'Uttar Pradesh', '230201', '', 'dealer', '', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-01-24 10:19:17', '', 20, 19, '2026-01-24 10:50:51'),
(21, 'Zinam valley power pvt ltd', 'Asab Uddin', 'asabuddin1408@gmail.com', '9101708036', '', '', '', '', 'Assam', '782446', '', 'other', '', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-01-28 08:24:54', '', 21, 20, '2026-01-28 08:27:32'),
(22, 'Kavita Praveen Kymar', 'Praveen kumar Gehlot', 'pkrajgeh78@gmail.com', '9828844001', '70J, Mohan Niwas , Ganga Vihar , Opp SBI Bank', 'Sector 2 , Kuri Bhagtasni Housing Board , Basni I', 'JODHPUR', 'JODH0UR', 'Rajasthan', '342005', '08CRL0K1947G2ZI', 'installer', '', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-01-28 11:14:48', '', 22, 21, '2026-01-30 08:33:36'),
(23, 'Harsh enterprise', 'Tejveer singh', 'singhtejveer764@gmail.com', '9675591591', 'Akbarpur gonda road aligarh', '', 'Aligarh', 'Aligarh', 'Uttar pradesh', '202002', '09FVSPS3659M2Z', 'retailer', '100000', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-02-03 08:53:21', '', 24, 23, '2026-02-04 10:09:54'),
(24, 'NAVEEN BEST ELECTRONICS', 'Gnanaprakasam Kandhasamy', 'knaveenbest@gmail.com', '9842744824', '5/143 chinnagounder thottam', 'Andagaloor Gate', 'Rasipuram', 'NAMAKKAL', 'Tamil Nadu', '637401', '', 'service', '10', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.\nNAVEEN SOLAR CONCEPTS & NAVEEN FIBER INTERNET', NULL, NULL, NULL, 'approved', '2026-02-04 10:06:42', '', 23, 22, '2026-02-04 10:09:51'),
(25, 'GT green technology', 'Tikam patel', 'teekampatel.tp@gmail.com', '7000106618', 'Guniyadipa bhikapali  post patharala', '', 'Basna', 'Mahasamund', 'Chhattisgarh', '493555', '22BJKPP6123K1Z3', 'dealer', '20-30', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.\nGt green technology lithium battery manufacturing company', NULL, NULL, NULL, 'approved', '2026-02-06 15:10:36', '', 25, 24, '2026-02-07 05:57:44'),
(26, 'Shri Shyam Sales Corporation', 'Jay Kumar Goyal', 'goin4jaykumar@gmail.com', '9672283829', 'Shop No. 14', 'Opp. Aggersain Dharmshala', 'Nohar', 'Hanumangarh', 'Rajasthan', '335523', '', 'dealer', '', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-02-07 09:59:32', '', 26, 25, '2026-02-08 11:48:09'),
(27, 'Mahalaxmi electronics and furniture', 'ram pratap godara', 'rmachara2010@gmail.com', '7791894691', 'lalgarh road', 'katar chhoti', 'katar', 'churu', 'rajasthan', '331517', '08AAZFM6570A1ZW', 'other', '', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-02-09 05:00:29', '', 27, 26, '2026-02-09 05:23:55'),
(28, 'Avigna Electricals', 'Nanjundaiah R', 'avignaelectricals@gmail.com', '6362717714', 'No 89-A, 12th Main Road, pipeline road,Near Anniebesant school,', 'Sreenivas Nagar,  sunkadkate, BENGALURU,  Karnataka 560091', 'Bengaluru', 'Bengaluru', 'Karnataka', '560091', '29ABUFA1219Q1ZQ', 'retailer', '5', 'solar_inverter', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.\nShare pricing details for inveters and battery', NULL, NULL, NULL, 'approved', '2026-02-09 06:32:00', '', 28, 27, '2026-02-09 06:33:51'),
(29, 'Tefinsol Solar World', 'Satpal Singh Kajla', 'tefinsol@gmail.com', '9888540245', 'Jaja Road Adda Jhawan VPO Jhawan', '', 'Tanda Urmar, (HOSHIARPUR)', 'Hoshiarpur', 'Punjab', '144212', '03ATOPK0368G1ZR', 'installer', '20', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.\nWe have 10 year experiance as EPC company.', NULL, NULL, NULL, 'approved', '2026-02-09 08:25:16', '', 29, 28, '2026-02-09 08:30:06'),
(30, 'Shiv solar traders', 'Ishver singh', 'vipink700@gmail.com', '9050006530', 'Loharu', 'Loharu', 'Loharu', 'Bhiwani', 'Haryana', '127201', '', 'retailer', '200000', 'solar_inverter', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, '', '2026-02-09 11:16:05', NULL, NULL, NULL, NULL),
(31, 'Alak Debbarma', '9612680103', 'alak78@gmail.com', '9612680103', 'Kathal Bagan, Gourkha basti', 'Green Heritage complex', 'Agartala', 'West Tripura', 'Tripura', '799006', '', 'installer', '', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-02-09 15:01:39', '', 31, 30, '2026-02-10 05:19:16'),
(32, 'Hayat solar & eng works', 'Mohammad hayat', 'khanhayat96@gmail.com', '7992091298', 'Hainsi jaichandra Sadar pratapgarh', 'Mauaima paryagraj', 'Paryagraj', 'Paryagraj', 'Uttarpradesh', '212587', '09AHMPH0584M2ZT', 'dealer', '10 inverter', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-02-10 02:57:39', '', 30, 29, '2026-02-10 05:18:44'),
(33, 'AZLAN POWER SOLUTIONS', 'MOHD HASAN KHAN', 'mohdhasankhan908@gmail.com', '8430441482', 'House no 114 vill and post singan khera teh sadar', 'Rampur Uttar Pradesh', 'Rampur', 'Rampur', 'Uttar Pradesh', '244927', '09JBIPK0261B2ZU', 'dealer', '30', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-02-10 12:04:32', '', 32, 31, '2026-02-10 12:05:26'),
(34, 'Ayansh Infotech Private Limited', 'Manoj Kumar', 'ayansh.mzp@gmail.com', '9304220886', '5th Floor, Nilam Complex, Harisabha Road', 'Ramna', 'Muzaffarpur', 'Muzaffarpur', 'Bihar', '842002', '10AAQCA8557R1ZW', 'other', '5', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-02-11 12:31:01', '', 33, 32, '2026-02-12 06:08:16'),
(35, 'Chaudhary Electricals', 'Vijay choudhary', 'chaudharyelectricals.in@gmail.com', '8884147374', 'Naveen Galla Mondi Etah Rode', 'Tundla', 'Tundla', 'Tundla', 'Uttar Pradesh', '283204', '09EKXPK2768G2ZB', 'dealer', '20', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-02-12 07:11:50', '', 34, 33, '2026-02-12 08:38:59'),
(36, 'solartec enterprises', 'Ravichandra Swami', 'solartecsolarsolutions@gmail.com', '9110897771', '28, swami nivas, opp water tank, bidar road, bank colony, hallikhed (B)', '', 'humnabad', 'bidar', 'karnataka', '585414', '', 'dealer', '', 'solar_inverter', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.\ni m in solar and renewable business since 2019, can install and troubleshoot solar systems, aware with latest products and there functioning', NULL, NULL, NULL, 'approved', '2026-02-13 18:30:32', '', 37, 36, '2026-02-19 06:01:56'),
(37, 'Mambo Distributors', 'Prince Bansal', 'princescaff@yahoo.com', '9888000001', 'PH-8, FOCAL POINT, MANGLI', '', 'Ludhiana', 'Ludhiana', 'PUNJAB', '141010', '03FHRPB4351J1ZB', 'dealer', '20', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-02-13 20:48:09', '', 35, 34, '2026-02-14 05:43:41'),
(38, 'shubham', 'shubham', 'goldensonsms34@gmail.con', '9568898424', 'behjoi road chandausi', '', 'chandausi', 'sambhal', 'uttar pradesh', '244412', '', 'installer', '', 'solar_inverter', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-02-18 15:19:26', '', 36, 35, '2026-02-19 06:01:47'),
(39, 'S.K Computer Services and Electricals', 'Santosh Khaire', 'santoshkhaire6259@gmail.com', '7218070450', 'AT.Khairewadi Po. Kanhur Mesai Tal.Shirur Dist. Pune', '', 'Shirur', 'Pune', 'Maharashtra', '412218', '27HDYPK0168P1ZG', 'dealer', '10', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-02-21 04:31:59', '', 38, 37, '2026-02-21 05:26:38'),
(40, 'NRG Infra Netzero Private Limited', 'Mahan Hansraj', 'compliance@netzeronrg.com', '7509330933', '', '', '', '', 'Uttar Pradesh', '201311', '', 'dealer', '', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-02-23 09:02:36', '', 39, 38, '2026-02-25 05:10:54'),
(41, 'Ebad', '9897055000', 'ebad.khan29@gmail.com', '9837869888', '183-Miya Sarai, Khari Kuan, Nawabo Wali Masjid,', '', 'Sambhal', 'Sambhal', 'Uttar Pradesh', '244302', '', 'other', '', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-02-25 13:48:22', '', 40, 39, '2026-02-25 13:48:39'),
(42, 'Vedika Power', 'Dilip Kumar Singh', 'ved4power@gmail.com', '8638454043', 'Bhitorsuti, Kaliabhomora', 'No 1 Dolabari', 'Tezpur', 'Sonitpur', 'Assam', '784027', '18AAIHD0146C1ZT', 'dealer', '5', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.\nWe are currently have many installations in many states like Assam, Arunachal Pradesh, Nagaland and Meghalaya', NULL, NULL, NULL, 'approved', '2026-02-26 05:54:41', '', 41, 40, '2026-02-26 05:59:32'),
(43, 'Future electronics', 'Mohit jain', 'mohitjain221992@gmail.com', '9582371579', 'Office 49 chandan hulla fatepure beri new delhi', '', 'New delhi', 'Delhi', 'New delhi', '110074', '07AAHPJ5343G1ZT', 'dealer', '10', 'solar_inverter', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-03-01 02:46:12', '', 42, 41, '2026-03-03 06:25:55'),
(44, 'Long step power technology pvt ltd', 'Sanjay Kumar', 'sanjaysaini3662@gmail.com', '8708513389', 'Vishnu colony,Near Vishnu mandir, railway road', '', 'Mahendergarh', 'Mahendergarh', 'Haryana', '123029', '06AADCL5033G2ZS', 'dealer', '', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-03-02 14:51:42', '', 43, 42, '2026-03-03 06:25:58'),
(45, 'UP TECH ENTERPRISES', 'ALIM ZAIDI', 'uptech110@gmail.com', '8909323236', 'FIRST FLOOR WARD 2 MUSTARK', 'NEAR THANA MIRANPUR', 'Muzaffarnagar', 'Muzaffarnagar', 'Uttar Pradesh ( 09 )', '251315', '09AXIPA8736C1ZJ', 'other', '30', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-03-05 09:18:13', '', 44, 43, '2026-03-05 09:31:49'),
(46, 'DIKSHIT AQUA', 'GAURAV TYAGI', 'krystaltechnology47@gmail.com', '7011142030', 'A1/1 DEDHA MARKET KHICHRIPUR DELHI', 'G-42 1ST FLOOR SEC-9 NOIDA', 'NOIDA', 'GAUTAM BUDDH NAGAR', 'UTTAR PRADESH', '201301', '07BFIPG7048J1Z7', 'dealer', '20', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-03-06 11:59:49', '', 45, 44, '2026-03-07 06:46:06'),
(47, 'Swapnpurti enterprises', 'Dipak Wagaj', 'chandrakantwgaj@gmail.com', '9518527107', 'At.post-Shetphal  pin.code-413324', '-', 'Shetphal', 'Solapur', 'Maharashtra', '413324', '', 'dealer', '', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-03-07 07:53:15', '', 46, 45, '2026-03-09 06:36:59'),
(48, 'vivek kumar maurya', '8299548267', 'jvmenterprises2025@gmail.com', '8299548267', 'vill and post sikanderpur distic-ambedkarnagar up224186', '', 'akbarpur', 'ambedkarnagar', 'utter pardesh', '224122', '09BNEPM8955N1Z2', 'dealer', '20', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.\niam vendor for up neda', NULL, NULL, NULL, 'approved', '2026-03-14 06:12:36', '', 47, 46, '2026-03-14 06:22:35'),
(49, 'Bhati Enterprises', 'Rahul bhati', 'rahulbhati1514@gmail.com', '9548359974', 'Village Falaida teh jewar', '', 'Greater noida', 'Gautam budhh nagar', 'Uttar pradesh', '203135', '', 'dealer', '', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-03-14 06:43:10', '', 48, 47, '2026-03-14 06:52:56'),
(50, 'Komesh choudhary', 'Karishna paower system', 'komeshsbl2000@gmail.com', '9412625655', 'Shop No 01,Lalit Kumar Building,SH 51, CHANDAWLI, SAMBHAL', '', 'Sambhal', 'Sambhal', 'U P', '244302', '09CBBPCTO11J1ZT', 'retailer', '10', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-03-15 04:32:15', '', 49, 48, '2026-03-16 06:06:46'),
(51, 'Bharat Business Deals', 'LALIT KUMAR AGRAWAL', 'lalitlalit@gmail.com', '7000484146', 'Geet Siya, 32 Bangala Compound, Ashoka Ratan', 'Shankar Nagar Raipur Chhattisgarh', 'Raipur', 'Raipur', 'Chhattisgarh', '492004', '22ACJPA6781H3ZO', 'dealer', '15 per month', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-03-17 08:01:16', '', 51, 50, '2026-03-18 06:50:04'),
(52, 'Aditya Energy', 'Bhagirathi Pattajoshi', 'adityaenergy3@gmail.com', '9337102557', '166-B, Mancheswar Industrial Estate,Bhubaneswar', '', 'Bhubaneswar', 'Khorda', 'Odisha', '751010', '21AAQPP8385D1ZE', 'dealer', '10', 'solar_inverter', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-03-18 04:39:01', '', 50, 49, '2026-03-18 06:49:10'),
(53, 'Radhe Krishna electronics', 'Satish', 'satish.soni8242@gmail.com', '9728318242', 'Vpo Birohar dist jahjjar Haryana pin code 124106', 'Vpo Birohar dist jahjjar Haryana pin code 124106', 'Jahjjar', 'Jahjjar', 'Haryana', '124106', '', 'installer', '10', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-03-18 09:28:06', '', 53, 52, '2026-03-18 12:59:45'),
(54, 'Takdir singh', 'Amit', 'm7135441@gmail.com', '9813212264', 'Khushi entertainment', 'ladwa road Pipli kurukshetra', 'Pipli', 'Kurukshetra', 'Haryana', '136131', '', 'retailer', '1-2', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-03-18 09:38:02', '', 52, 51, '2026-03-18 12:59:37'),
(55, 'AANJANEY', 'Aanjaney', 'aanjaney@outlook.in', '9911309599', 'Aanjaney business services, 219, Rudra Aksha Ward 7 Brahman Para', 'Mohbhattha Road near Garden (flyover) Bemetara', 'Bemetara', 'Bemetara', 'Chhattisgarh', '491335', '22HFMPK4386B1ZF', 'other', '', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.\nAanjaney business services', NULL, NULL, NULL, 'approved', '2026-03-20 08:53:43', '', 54, 53, '2026-03-20 08:56:51'),
(56, 'V-Sun Traders and Marketing', 'Vivian Vincent', 'vsuntraders@gmail.com', '9176213062', 'Perandoor Road, Near Thannikkal Junction', 'Elamakkara P. O, Kaloor, Ernakulam', 'Ernakulam', '', 'Kerala', '682026', '32BQFPK1157G1Z7', 'dealer', '', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-03-21 12:12:31', '', 57, 56, '2026-03-23 07:28:19'),
(57, 'Sigma cctv systems', 'Kulwinder singh', 'sigmacctv@hotmail.com', '9878688824', 'Kocher market', 'Model gram', 'Ludhiana', 'Ludhiana', 'Punjab', '141002', '03ANQPS4267C1ZV', 'dealer', '20/month', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.\nNa', NULL, NULL, NULL, 'approved', '2026-03-22 06:11:11', '', 56, 55, '2026-03-23 07:28:15'),
(58, 'ANUPAM INNOVATIONS', 'ANUPAM SINGH', 'anupaminnovations@gmail.com', '9935227361', 'Khasra No. 301/1 Saidupur', 'Hanumanganj', 'Prayagraj', 'Prayagraj', 'Uttar Pradesh', '221505', '09CABPS027A1ZZ', 'retailer', '10+', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.\nWe are Registered Vendor on PM Surya Ghar Portal an UPNEDA, We are in this Business from 2017, We are working in city as well as rural areas but we are focusing on the largest Market that is Rural India ( Present Rural Areas of Uttar Pradesh', NULL, NULL, NULL, 'approved', '2026-03-23 06:05:33', '', 55, 54, '2026-03-23 06:08:40'),
(59, 'SUNJERSON', 'SYED MOHD SAIF', 'syed.mohammad.saif@gmail.com', '9953036076', 'S7.125A GOLGHAR KACHAHRI  , VARANASI', '', '', '', 'UTTAR PRADESH', '221002', '', 'other', '20', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, 'approved', '2026-03-24 17:30:49', '', 58, 57, '2026-03-25 06:30:39'),
(60, 'AANJANEY', 'Aanjaney', 'aanjaney1@hotmail.com', '9399476792', 'Aanjaney business services', '219, Rudra Aksha ward 7 Brahman para, Mohbhattha Road near Garden (flyover)', 'Bemetara', 'Bemetara', 'Chhattisgarh', '491335', '22HFMPK4386B1ZF', 'other', '', 'all', 'Security Deposit: Applicant acknowledged ₹1,00,000 refundable security deposit.', NULL, NULL, NULL, '', '2026-03-25 09:50:46', NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `dealer_login_otps`
--

CREATE TABLE `dealer_login_otps` (
  `id` int(11) NOT NULL,
  `mobile` varchar(20) NOT NULL,
  `otp_hash` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `attempts` int(11) NOT NULL DEFAULT 0,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `dealer_payments`
--

CREATE TABLE `dealer_payments` (
  `id` int(11) NOT NULL,
  `dealer_id` int(11) NOT NULL,
  `type` enum('security_deposit','order_payment') NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `proof_path` varchar(255) NOT NULL,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `admin_remarks` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `approved_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `dealer_promo_requests`
--

CREATE TABLE `dealer_promo_requests` (
  `id` int(11) NOT NULL,
  `dealer_id` int(11) NOT NULL,
  `request_type` varchar(50) NOT NULL,
  `subject` varchar(200) NOT NULL,
  `details` text NOT NULL,
  `estimated_budget` decimal(12,2) DEFAULT NULL,
  `status` enum('open','in_review','approved','rejected','closed') DEFAULT 'open',
  `admin_notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `dealer_promo_requests`
--

INSERT INTO `dealer_promo_requests` (`id`, `dealer_id`, `request_type`, `subject`, `details`, `estimated_budget`, `status`, `admin_notes`, `created_at`, `updated_at`) VALUES
(1, 1, 'shop_branding', 'need sds', 'sfvs', 10000.00, 'approved', '', '2025-12-11 15:29:57', '2025-12-13 08:42:21'),
(2, 1, 'digital_marketing', 'Utgiygiuhouho8h', 'Guigiug', 2000.00, 'open', NULL, '2025-12-17 21:34:27', NULL),
(3, 1, 'shop_branding', 'branding', 'kyfkyfjyhcf', 9000.00, 'open', NULL, '2025-12-19 10:30:53', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` int(11) NOT NULL,
  `dealer_id` int(11) NOT NULL,
  `order_number` varchar(50) NOT NULL,
  `status` enum('pending','confirmed','dispatched','delivered','cancelled') NOT NULL DEFAULT 'pending',
  `total_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `payment_status` enum('pending','received','rejected') NOT NULL DEFAULT 'pending',
  `payment_received_at` date DEFAULT NULL,
  `dispatch_due_date` date DEFAULT NULL,
  `dispatch_date` date DEFAULT NULL,
  `dispatch_courier` varchar(100) DEFAULT NULL,
  `dispatch_awb` varchar(100) DEFAULT NULL,
  `dispatch_remarks` varchar(255) DEFAULT NULL,
  `payment_proof_path` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `proforma_number` varchar(50) DEFAULT NULL,
  `proforma_date` date DEFAULT NULL,
  `final_invoice_number` varchar(50) DEFAULT NULL,
  `final_invoice_date` date DEFAULT NULL,
  `final_invoice_file_path` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`id`, `dealer_id`, `order_number`, `status`, `total_amount`, `payment_status`, `payment_received_at`, `dispatch_due_date`, `dispatch_date`, `dispatch_courier`, `dispatch_awb`, `dispatch_remarks`, `payment_proof_path`, `created_at`, `proforma_number`, `proforma_date`, `final_invoice_number`, `final_invoice_date`, `final_invoice_file_path`) VALUES
(27, 5, 'MGPO-1768811306', 'pending', 53041.00, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-01-19 08:28:26', NULL, NULL, NULL, NULL, NULL),
(28, 5, 'MGPO-1768883403', 'pending', 50622.00, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-01-20 04:30:03', NULL, NULL, NULL, NULL, NULL),
(31, 13, 'MGPO-1768981407', 'pending', 146664.00, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-01-21 07:43:27', NULL, NULL, NULL, NULL, NULL),
(32, 15, 'MGPO-1769249920', 'pending', 71620.50, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-01-24 10:18:40', NULL, NULL, NULL, NULL, NULL),
(33, 15, 'MGPO-1769250074', 'pending', 71620.50, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-01-24 10:21:14', NULL, NULL, NULL, NULL, NULL),
(34, 10, 'MGPO-1769276215', 'pending', 106082.00, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-01-24 17:36:55', NULL, NULL, NULL, NULL, NULL),
(35, 10, 'MGPO-1769276281', 'pending', 59020.50, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-01-24 17:38:01', NULL, NULL, NULL, NULL, NULL),
(36, 10, 'MGPO-1769508280', 'pending', 165102.50, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-01-27 10:04:40', NULL, NULL, NULL, NULL, NULL),
(37, 16, 'MGPO-1769521850', 'pending', 26470.50, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, 'dealer/uploads/payment_proofs/order_37_dealer_16_20260127_153023.jpeg', '2026-01-27 13:50:50', NULL, NULL, NULL, NULL, NULL),
(38, 16, 'MGPO-1769527758', 'pending', 26470.50, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, 'dealer/uploads/payment_proofs/order_38_dealer_16_20260127_153004.jpeg', '2026-01-27 15:29:18', NULL, NULL, NULL, NULL, NULL),
(39, 7, 'MGPO-1769664055', 'pending', 53041.00, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-01-29 05:20:55', NULL, NULL, NULL, NULL, NULL),
(40, 7, 'MGPO-1769669518', 'pending', 241679.50, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-01-29 06:51:58', NULL, NULL, NULL, NULL, NULL),
(41, 20, 'MGPO-1770122423', 'pending', 193461.00, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-02-03 12:40:23', NULL, NULL, NULL, NULL, NULL),
(42, 20, 'MGPO-1770197359', '', 193461.00, '', '2026-02-06', NULL, NULL, NULL, NULL, NULL, NULL, '2026-02-04 09:29:19', NULL, NULL, NULL, NULL, NULL),
(43, 10, 'MGPO-1770358427', 'pending', 124661.50, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-02-06 06:13:47', NULL, NULL, NULL, NULL, NULL),
(44, 14, 'MGPO-1770725529', '', 124661.50, '', '2026-02-10', NULL, NULL, NULL, NULL, NULL, 'dealer/uploads/payment_proofs/order_44_dealer_14_20260210_121735.jpeg', '2026-02-10 12:12:09', NULL, NULL, NULL, NULL, NULL),
(45, 14, 'MGPO-1770725726', 'pending', 130641.00, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-02-10 12:15:26', NULL, NULL, NULL, NULL, NULL),
(46, 30, 'MGPO-1770982372', 'pending', 82556.50, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-02-13 11:32:52', NULL, NULL, NULL, NULL, NULL),
(47, 22, 'MGPO-1771347316', 'pending', 50622.00, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-02-17 16:55:16', NULL, NULL, NULL, NULL, NULL),
(48, 7, 'MGPO-1771674140', 'pending', 389767.00, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-02-21 11:42:20', NULL, NULL, NULL, NULL, NULL),
(49, 7, 'MGPO-1772862841', 'pending', 412782.50, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 05:54:01', NULL, NULL, NULL, NULL, NULL),
(50, 37, 'MGPO-1773834752', '', 90340.80, '', '2026-03-19', NULL, NULL, NULL, NULL, NULL, 'dealer/uploads/payment_proofs/order_50_dealer_37_20260319_060954.jpeg', '2026-03-18 11:52:32', NULL, NULL, NULL, NULL, NULL),
(51, 37, 'MGPO-1774158025', 'pending', 137363.80, '', '2026-03-23', NULL, NULL, NULL, NULL, NULL, 'dealer/uploads/payment_proofs/order_51_dealer_37_20260323_054206.pdf', '2026-03-22 05:40:25', NULL, NULL, NULL, NULL, NULL),
(52, 7, 'MGPO-1774258897', 'pending', 530410.00, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-23 09:41:37', NULL, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `order_items`
--

CREATE TABLE `order_items` (
  `id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `unit_price` decimal(12,2) NOT NULL,
  `line_total` decimal(14,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `order_items`
--

INSERT INTO `order_items` (`id`, `order_id`, `product_id`, `quantity`, `unit_price`, `line_total`) VALUES
(33, 27, 7, 1, 44950.00, 53041.00),
(34, 28, 6, 1, 42900.00, 50622.00),
(37, 31, 9, 18, 7760.00, 146664.00),
(38, 32, 8, 1, 68210.00, 71620.50),
(39, 33, 8, 1, 68210.00, 71620.50),
(40, 34, 7, 2, 44950.00, 106082.00),
(41, 35, 3, 1, 56210.00, 59020.50),
(42, 36, 7, 2, 44950.00, 106082.00),
(43, 36, 3, 1, 56210.00, 59020.50),
(44, 37, 2, 1, 25210.00, 26470.50),
(45, 38, 2, 1, 25210.00, 26470.50),
(46, 39, 7, 1, 44950.00, 53041.00),
(47, 40, 7, 4, 44950.00, 212164.00),
(48, 40, 4, 1, 28110.00, 29515.50),
(49, 41, 5, 6, 27325.00, 193461.00),
(50, 42, 5, 6, 27325.00, 193461.00),
(51, 43, 8, 1, 68210.00, 71620.50),
(52, 43, 7, 1, 44950.00, 53041.00),
(53, 44, 8, 1, 68210.00, 71620.50),
(54, 44, 7, 1, 44950.00, 53041.00),
(55, 45, 8, 1, 68210.00, 71620.50),
(56, 45, 3, 1, 56210.00, 59020.50),
(57, 46, 7, 1, 44950.00, 53041.00),
(58, 46, 4, 1, 28110.00, 29515.50),
(59, 47, 6, 1, 42900.00, 50622.00),
(60, 48, 10, 2, 21500.00, 45150.00),
(61, 48, 7, 2, 44950.00, 106082.00),
(62, 48, 5, 2, 27325.00, 64487.00),
(63, 48, 4, 5, 28110.00, 147577.50),
(64, 48, 2, 1, 25210.00, 26470.50),
(65, 49, 7, 5, 44950.00, 265205.00),
(66, 49, 4, 5, 28110.00, 147577.50),
(67, 50, 15, 1, 31610.00, 37299.80),
(68, 50, 7, 1, 44950.00, 53041.00),
(69, 51, 14, 1, 30610.00, 36119.80),
(70, 51, 6, 2, 42900.00, 101244.00),
(71, 52, 7, 10, 44950.00, 530410.00);

-- --------------------------------------------------------

--
-- Table structure for table `otp_logins`
--

CREATE TABLE `otp_logins` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `mobile` varchar(15) NOT NULL,
  `otp` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `verified_at` datetime DEFAULT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `attempts` int(11) NOT NULL DEFAULT 0,
  `last_sent_at` datetime NOT NULL DEFAULT current_timestamp(),
  `ip` varchar(64) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `otp_hash` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `password_resets`
--

CREATE TABLE `password_resets` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `token_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payments`
--

CREATE TABLE `payments` (
  `id` int(11) NOT NULL,
  `dealer_id` int(11) NOT NULL,
  `order_id` int(11) DEFAULT NULL,
  `amount` decimal(14,2) NOT NULL,
  `type` enum('payment','adjustment') NOT NULL DEFAULT 'payment',
  `description` varchar(255) DEFAULT NULL,
  `tx_date` date NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `sku` varchar(100) NOT NULL,
  `category` varchar(100) NOT NULL,
  `mrp` decimal(12,2) NOT NULL,
  `dealer_price` decimal(12,2) NOT NULL,
  `gst_rate` int(11) NOT NULL DEFAULT 18,
  `warranty_months` int(11) NOT NULL DEFAULT 12,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `products`
--

INSERT INTO `products` (`id`, `name`, `sku`, `category`, `mrp`, `dealer_price`, `gst_rate`, `warranty_months`, `is_active`, `created_at`) VALUES
(2, 'MG 4.2 KW Hybrid Solar Inverter', 'MG4224HYD', 'Solar Inverter', 79990.00, 25210.00, 18, 24, 1, '2025-12-10 09:55:03'),
(3, 'MG 10.2 KW Hybrid Solar Inverter', 'MG10248HYD', 'Solar Inverter', 142990.00, 56210.00, 18, 24, 1, '2025-12-10 12:34:10'),
(4, 'MG 6.2 KW Hybrid Solar Inverter', 'MG6248HYD', 'Solar Inverter', 89990.00, 28110.00, 18, 24, 1, '2025-12-13 10:26:01'),
(5, 'MG 24V 120AH Li Batt Fully Smart', 'MGLIBATT24120', 'Lithium Battery', 45210.00, 27325.00, 18, 60, 1, '2025-12-20 08:50:16'),
(6, 'MG 48V 120 AH Li Batt Fully Smart', 'MGLIBATT48120', 'Lithium Battery', 62999.00, 42900.00, 18, 60, 1, '2025-12-20 08:51:40'),
(7, 'MG 51.2V 120AH Li Batt Fully Smart', 'MGLIBATT51120', 'Lithium Battery', 70765.00, 44950.00, 18, 60, 1, '2025-12-20 08:52:39'),
(8, 'MG 11 KW Hybrid Solar Inverter', 'MG1148HYD', 'Solar Inverter', 86210.00, 68210.00, 18, 24, 1, '2025-12-20 08:56:36'),
(9, 'MG 575W Bifacial Mono Perc Panels', 'MG575WBMPP', 'Solar Panel', 12500.00, 7760.00, 5, 60, 1, '2025-12-20 09:02:05'),
(10, 'MG 3KW TL Off-Grid Inverter', 'MG3KW24V', 'Solar Inverter', 36210.00, 21500.00, 18, 24, 1, '2025-12-20 16:00:31'),
(14, 'MG 6.2kW 48V Focus Series Hybrid Solar Inverter 9000W PV Input 120A MPPT IP45', 'MG6248HYDFOCUS', 'Solar Inverter', 42210.00, 30610.00, 18, 24, 1, '2026-03-14 07:39:07'),
(15, 'MG Titan Series 6.2kW Hybrid Solar Inverter | 48V System | 120A Battery Charger | 27A PV Input | Up to 9kW Solar Support | Parallel up to 9 Inverters', 'MGTITAN6', 'Solar Inverter', 48210.00, 31610.00, 18, 24, 1, '2026-03-18 09:02:40');

-- --------------------------------------------------------

--
-- Table structure for table `promo_schemes`
--

CREATE TABLE `promo_schemes` (
  `id` int(11) NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `min_order_value` decimal(12,2) DEFAULT 0.00,
  `min_total_qty` int(11) DEFAULT 0,
  `incentive_type` enum('percent_on_value','flat_per_unit','fixed_bonus') DEFAULT 'percent_on_value',
  `incentive_value` decimal(12,2) NOT NULL DEFAULT 0.00,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `security_deposits`
--

CREATE TABLE `security_deposits` (
  `id` int(11) NOT NULL,
  `dealer_id` int(11) NOT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT 100000.00,
  `status` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `payment_date` date DEFAULT NULL,
  `payment_reference` varchar(100) DEFAULT NULL,
  `proof_path` varchar(255) DEFAULT NULL,
  `admin_notes` text DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- Dumping data for table `security_deposits`
--

INSERT INTO `security_deposits` (`id`, `dealer_id`, `amount`, `status`, `payment_date`, `payment_reference`, `proof_path`, `admin_notes`, `approved_at`, `created_at`, `updated_at`) VALUES
(1, 1, 100000.00, 'PENDING', NULL, NULL, NULL, NULL, NULL, '2026-01-17 12:21:20', '2026-01-17 12:21:20');

-- --------------------------------------------------------

--
-- Table structure for table `tickets`
--

CREATE TABLE `tickets` (
  `id` int(11) NOT NULL,
  `dealer_id` int(11) NOT NULL,
  `product_id` int(11) DEFAULT NULL,
  `customer_name` varchar(255) DEFAULT NULL,
  `customer_phone` varchar(50) DEFAULT NULL,
  `issue_description` text NOT NULL,
  `attachment_path` varchar(255) DEFAULT NULL,
  `admin_notes` text DEFAULT NULL,
  `dealer_message` text DEFAULT NULL,
  `dealer_message_seen` tinyint(1) NOT NULL DEFAULT 0,
  `status` enum('open','in_progress','resolved','rejected') NOT NULL DEFAULT 'open',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `tickets`
--

INSERT INTO `tickets` (`id`, `dealer_id`, `product_id`, `customer_name`, `customer_phone`, `issue_description`, `attachment_path`, `admin_notes`, `dealer_message`, `dealer_message_seen`, `status`, `created_at`, `updated_at`) VALUES
(6, 5, 7, 'AUDIITER', '', 'payment link unavailable', '/uploads/tickets/ticket_20260119_083701_759128f8_2026-01-07_01_43_21-Custom_Page___Shop_online_at_A.png', NULL, NULL, 0, 'open', '2026-01-19 08:37:01', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `ticket_activity`
--

CREATE TABLE `ticket_activity` (
  `id` int(11) NOT NULL,
  `ticket_id` int(11) NOT NULL,
  `actor_role` varchar(20) NOT NULL,
  `actor_user_id` int(11) DEFAULT NULL,
  `action` varchar(50) NOT NULL,
  `old_status` varchar(50) DEFAULT NULL,
  `new_status` varchar(50) DEFAULT NULL,
  `note` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ticket_attachments`
--

CREATE TABLE `ticket_attachments` (
  `id` int(11) NOT NULL,
  `ticket_id` int(11) NOT NULL,
  `uploader_role` varchar(20) NOT NULL,
  `uploader_user_id` int(11) DEFAULT NULL,
  `file_path` varchar(255) NOT NULL,
  `original_name` varchar(255) DEFAULT NULL,
  `mime_type` varchar(120) DEFAULT NULL,
  `file_size` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `role` enum('admin','dealer') NOT NULL DEFAULT 'dealer',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `force_password_change` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `email`, `password`, `name`, `role`, `created_at`, `force_password_change`) VALUES
(1, 'admin@musclegrid.in', '$2y$10$3zGpxdJSVjDTSIFlny2CbOlE2HJ9WEtFIzcYnQgPEHoGgPKRtG7Vy', 'System Admin', 'admin', '2025-12-09 22:51:09', 0),
(2, 'rony@usa.com', '$2y$10$AX/S/m1DwWEWnu2DNk0KJesqXwnBswIYj4LUsuW98//QPTlxHlvCC', 'Rony', 'dealer', '2025-12-09 23:14:45', 0),
(3, 'shweta@musclegrid.in', '$2y$10$wvxCLQedwQMyvmKyQ239EOROMgIyqyaXabVIStgKI6bqrOFO6SHIG', 'abx', 'dealer', '2025-12-14 00:45:24', 0),
(4, 'laxmikantshinde54321@gmail.com', '$2y$10$Ap2/kIWgcDpJTpYJbk0P..HAhEPEkbc04zx.wV27vSl4NNVi6ozna', '8431809797', 'dealer', '2025-12-16 12:37:29', 0),
(5, 'brighttrades365@gmail.com', '$2y$10$9hLeMrTm9qodvnqH6OQ6SunEr/HpY2k1kHGBIchsKb3oSUYjdT9mO', '9445543407', 'dealer', '2025-12-28 10:44:41', 0),
(6, 'audiiterstaff@gmail.com', '$2y$10$5Ag12ZPP5pGHgz43sKmkz.VV52J5FmkblwdNqMlsume8eaLrJwmYW', 'AUDIITER', 'dealer', '2025-12-28 10:44:47', 0),
(7, 'rajeshsinghdagar@gmail.com', '$2y$10$mNO8nTg5iQlCRIrM/BCCGusCElFMO202aPnqvZjenx1LI5/LtKE56', 'Vinod Kumar', 'dealer', '2026-01-07 09:30:20', 0),
(8, 'dksingpu3@gmail.com', '$2y$10$TGUsfghC6nFHYypHXzeyYezY32ammwDhWNl4puGqSOELZjPpHB8QS', 'Bernard Kamliansanga', 'dealer', '2026-01-07 09:30:24', 0),
(9, 'primegridpower@gmail.com', '$2y$10$QFr8fRdKoHrwcIkBQlbbc.fon46BLKaOlA4f5oWc23KEuP4zUWNSe', 'Javed Ali', 'dealer', '2026-01-07 09:30:27', 0),
(10, 'pvpowersolution@gmail.com', '$2y$10$tLR9XSOSFBr.tkAfiY1rjOCCPMIyh8EsWr6KwFNQkNkmk32V7uDze', 'Aman Jain', 'dealer', '2026-01-16 07:37:05', 0),
(11, 'jdmptechpvtltd@gmail.com', '$2y$10$HGSFDZFF2wmSLqN8/Ki0a.C6m2g9wngkx05EMgjumqVOhaD1XxN6O', 'Mukhjit singh', 'dealer', '2026-01-20 07:51:24', 0),
(12, 'royalitnnl@gmail.com', '$2y$10$QNqS8F/fSZwMiDh2GQkPLu67JcLfAgsCPiQZuVS5wfi5AGf2IuviS', 'Vishesh Kumar Yadav', 'dealer', '2026-01-20 07:51:30', 0),
(13, 'jeevangroupindia@gmail.com', '$2y$10$9Fs2ScrDZuy.p7zwDftHQOfp1C6CEGemh3.yhRyG2q93Qu7Xpu8cS', 'Jeevan group Enterprise', 'dealer', '2026-01-21 06:24:57', 0),
(14, 'nsdagarusd@gmail.com', '$2y$10$Z49g2N/EtZgPdpAYQEV/Fu4Ev1CUQNlv/WI0ic24wFyzLKPvFmLSq', 'Narender Singh', 'dealer', '2026-01-21 07:22:35', 0),
(15, 'pawan4587@gmail.com', '$2y$10$LxvLD81YfGDGw018nGJoG.YW7n1o1gVAI0hv1oi5ZYU3BXHSBeP/m', 'SANJIT KUMAR', 'dealer', '2026-01-23 05:10:30', 0),
(16, 'sumitdubey1902@gmail.com', '$2y$10$X5755vIGIzBmesiTNJu3NulpD2pafdNq2hfg/6mbVQuQkd.32j8Aa', 'Sumit Kumar Dubey', 'dealer', '2026-01-24 07:20:11', 0),
(17, 'vimleshsaini844@gmail.com', '$2y$10$VdwQurSWxRgDRSMWruPOb.iBaNoaCxFvrQ7j.G52LY.GQAL.LcG0a', 'VIMLESH KUMAR SAINI', 'dealer', '2026-01-24 07:20:47', 0),
(18, 'eurekafatehpur@gmail.com', '$2y$10$y7WeuhPli.Msicl3U9ofjuNOCV7VDzHNNuLLAiuRky3rcNXiBs1.a', 'Rakesh Kumar', 'dealer', '2026-01-24 09:41:58', 0),
(19, 'yasvly@gmail.com', '$2y$10$ySIwVE3lkYQ8/rGurMCQP.XhNxcaZSiCAZS.wpPiZBosyEfDu6nre', 'Yasir Puthukudi', 'dealer', '2026-01-24 10:50:47', 0),
(20, 'rakesh5996csc@gmail.com', '$2y$10$gTSYX0mHwhR6x9gOq2gqpOoqyRr.ASaE38DT9uJg4IQvI5VPaqjs2', 'Rakesh Kumar tiwari', 'dealer', '2026-01-24 10:50:51', 0),
(21, 'asabuddin1408@gmail.com', '$2y$10$k8qkR0RUwRiSzxPhbBzsVu7xYwIcTbFZFiNWi49PIDK1VGb/SrB1G', 'Asab Uddin', 'dealer', '2026-01-28 08:27:32', 0),
(22, 'pkrajgeh78@gmail.com', '$2y$10$F.5cQO14P8WUSSqRID1Kz./cAL654IE18rO4KkiGK1TQMBxz.MrQe', 'Praveen kumar Gehlot', 'dealer', '2026-01-30 08:33:36', 0),
(23, 'knaveenbest@gmail.com', '$2y$10$UbJRUZyAK2eCEgxHrafpP.2q1RFMmJ9Nsyuuk7PnpWcVCwWeYVVjO', 'Gnanaprakasam Kandhasamy', 'dealer', '2026-02-04 10:09:51', 0),
(24, 'singhtejveer764@gmail.com', '$2y$10$wZtL7JBXVkZkLJxdOmcPneGqryzgqV2NOTXvsmj5PnFsomx4sP0wm', 'Tejveer singh', 'dealer', '2026-02-04 10:09:54', 0),
(25, 'teekampatel.tp@gmail.com', '$2y$10$8c0CxKvtUZgnl893wcYteeixFPunOFSV.AAeh8tFIMzQpow7LA5oi', 'Tikam patel', 'dealer', '2026-02-07 05:57:44', 0),
(26, 'goin4jaykumar@gmail.com', '$2y$10$HEd5HvY641dNs.5cozqjOeh66zMx2O2TeNkfd5n.c.7sqbTPBHVle', 'Jay Kumar Goyal', 'dealer', '2026-02-08 11:48:09', 0),
(27, 'rmachara2010@gmail.com', '$2y$10$JPv/RpWZqPBlWOKemH5o6uzBoZLA/65MZovjdwXqsw3dlW88pes5C', 'ram pratap godara', 'dealer', '2026-02-09 05:23:55', 0),
(28, 'avignaelectricals@gmail.com', '$2y$10$Tpsf4LXlKoBWs8Ro.ujV8eyvIpjQZ03yhhcsg4qflXFchXDJywM5W', 'Nanjundaiah R', 'dealer', '2026-02-09 06:33:51', 0),
(29, 'tefinsol@gmail.com', '$2y$10$oZKuc6bxyCwBeYkEg3Tgi.raBOz3draHT.qNnGrDAsZkDmLRQ/eHK', 'Satpal Singh Kajla', 'dealer', '2026-02-09 08:30:06', 0),
(30, 'khanhayat96@gmail.com', '$2y$10$9H8Bf8pIITnLT5Z8UM8rtuhGi.qL.LngrXKqx2k.v8bLdPeFIhFRy', 'Mohammad hayat', 'dealer', '2026-02-10 05:18:44', 0),
(31, 'alak78@gmail.com', '$2y$10$iP6fRHkgXCwMNuQ.oo15NuZPfEGtMIsKDgdnKr6h2DZyX451AaXs6', '9612680103', 'dealer', '2026-02-10 05:19:16', 0),
(32, 'mohdhasankhan908@gmail.com', '$2y$10$T2NOuwgAnmG0E7A19SdgYOCH2yu60uwXjOzYenlgZs1StB8P6kxki', 'MOHD HASAN KHAN', 'dealer', '2026-02-10 12:05:26', 0),
(33, 'ayansh.mzp@gmail.com', '$2y$10$Wguz8ggyX2c41Wf.nLlMcOVooftJtWEp2n0bTeRrdP3daIuf1Rx.u', 'Manoj Kumar', 'dealer', '2026-02-12 06:08:16', 0),
(34, 'chaudharyelectricals.in@gmail.com', '$2y$10$iXcEwgCo5XvYSi9O/Uv5B.ybPJ1puc7htV83p1jUU6WTFg96qvCSa', 'Vijay choudhary', 'dealer', '2026-02-12 08:38:59', 0),
(35, 'princescaff@yahoo.com', '$2y$10$cOT8GQCBuiwFWgBKkg10kekZlnhIoByednG.KxqkdeXo3.BR0UY9y', 'Prince Bansal', 'dealer', '2026-02-14 05:43:41', 0),
(36, 'goldensonsms34@gmail.con', '$2y$10$UHfM93vHJyJnlD7rTmd/E.6E9ojVBWdO0YnjSNLf2uspuBlYcYNNS', 'shubham', 'dealer', '2026-02-19 06:01:47', 0),
(37, 'solartecsolarsolutions@gmail.com', '$2y$10$4cTHj3nGjtu.XnMCNXgeQOUkejm/zHYdRXHLQz/kjZmxdR86Q4UeK', 'Ravichandra Swami', 'dealer', '2026-02-19 06:01:56', 0),
(38, 'santoshkhaire6259@gmail.com', '$2y$10$ccH7cUJyV5EEA8XcIC2Gie9pnUR3wx1BoKgdCCGMNTaJqzalTj2uy', 'Santosh Khaire', 'dealer', '2026-02-21 05:26:38', 0),
(39, 'compliance@netzeronrg.com', '$2y$10$uGJMBVRUrn32X1vvlE97Kuh6mbnww28gyF5VN7zZcRRaOENtimsuu', 'Mahan Hansraj', 'dealer', '2026-02-25 05:10:54', 0),
(40, 'ebad.khan29@gmail.com', '$2y$10$4AiAxtbUXp9DEK8kx9MEluiAAyLmosWLauXO79MxWSMxJvfrotNXa', '9897055000', 'dealer', '2026-02-25 13:48:39', 0),
(41, 'ved4power@gmail.com', '$2y$10$3UodjtbE9DiSXXQd5.cM.ez24tAMD/oifcQo5YMN8g94Zna9BCWCG', 'Dilip Kumar Singh', 'dealer', '2026-02-26 05:59:32', 0),
(42, 'mohitjain221992@gmail.com', '$2y$10$.WN7/l/Hnjg2cIp6tuf64.H0cyghCOfDydCqieXPIaZG4SW7mnnRa', 'Mohit jain', 'dealer', '2026-03-03 06:25:55', 0),
(43, 'sanjaysaini3662@gmail.com', '$2y$10$zzHS9b.eDC9EZS2A3TWLO.nH37y09zEWs7wKH4L.eGjbPCuGCSW02', 'Sanjay Kumar', 'dealer', '2026-03-03 06:25:58', 0),
(44, 'uptech110@gmail.com', '$2y$10$RKRoUVWNRgpIqBFiuL4c/e3cEOelX8cAqMazoZy2Mhuuy3.T9GQHe', 'ALIM ZAIDI', 'dealer', '2026-03-05 09:31:49', 0),
(45, 'krystaltechnology47@gmail.com', '$2y$10$rlLNl8gXPA.tCCpJ.PRrz.sDZQs80IA47xty4seVjUFERmxfqXCCy', 'GAURAV TYAGI', 'dealer', '2026-03-07 06:46:06', 0),
(46, 'chandrakantwgaj@gmail.com', '$2y$10$YRrm8Ih7Xy0DDo0edhQDvuuPnDKSq0hTk81xXdDLCSOiNl6vLzXYK', 'Dipak Wagaj', 'dealer', '2026-03-09 06:36:59', 0),
(47, 'jvmenterprises2025@gmail.com', '$2y$10$PSSJEZbEPqJ9FKziPSxTh.TMI83u1JwD9Iqh8HuplNWxuXs8Yz7bG', '8299548267', 'dealer', '2026-03-14 06:22:35', 0),
(48, 'rahulbhati1514@gmail.com', '$2y$10$tipvHBOH/m/2kfdxS366FOlnP/6p.QeQgf/taSCeZtVCuOlukscq2', 'Rahul bhati', 'dealer', '2026-03-14 06:52:56', 0),
(49, 'komeshsbl2000@gmail.com', '$2y$10$dA/JKXAycqK9BmZgDggJLOtfagg3fiCcz.ZBN63.lUwNl5Sktk.jq', 'Karishna paower system', 'dealer', '2026-03-16 06:06:46', 0),
(50, 'adityaenergy3@gmail.com', '$2y$10$fmdLBNRZUgOZ.r47CrzbDe.A2lCBH6uENm6WfoYB7lWrE05lNIdJW', 'Bhagirathi Pattajoshi', 'dealer', '2026-03-18 06:49:10', 0),
(51, 'lalitlalit@gmail.com', '$2y$10$b0JTPb8zN6nx5mTi2Ld9GuPAyz03jvJ1Rzo5tgwV9ndLK81oxGY/.', 'LALIT KUMAR AGRAWAL', 'dealer', '2026-03-18 06:50:04', 0),
(52, 'm7135441@gmail.com', '$2y$10$AE7Ixj7NQEgiySutN7mmielvCLvQkHKYhYvTMQNt49g4Oo4mdLEvC', 'Amit', 'dealer', '2026-03-18 12:59:37', 0),
(53, 'satish.soni8242@gmail.com', '$2y$10$c4RJt0gcACbG2IXlzhgs2OstIcHLtCeYUUcIshFcHFtPJ1Z.czpAi', 'Satish', 'dealer', '2026-03-18 12:59:45', 0),
(54, 'aanjaney@outlook.in', '$2y$10$DkhnS7OuVS53Bbx4yN1d8.9Sefj7BiV1Y7QO8BBcdVHms228eXWYi', 'Aanjaney', 'dealer', '2026-03-20 08:56:51', 0),
(55, 'anupaminnovations@gmail.com', '$2y$10$7WdrdeRYZb5JCtUG.MApk.85/pQsPJI7wHcjxndTWiIpTSxP1wZ1G', 'ANUPAM SINGH', 'dealer', '2026-03-23 06:08:40', 0),
(56, 'sigmacctv@hotmail.com', '$2y$10$SAy9AuYpRPOEqkjL.SOGae2frr3LuW2FogI6gQVvnI5.dxhW1yzKu', 'Kulwinder singh', 'dealer', '2026-03-23 07:28:15', 0),
(57, 'vsuntraders@gmail.com', '$2y$10$3.h2dwaivYDjwVUm92jAxeQyT3MbtlluWCqaREKak98qWeZD2pNca', 'Vivian Vincent', 'dealer', '2026-03-23 07:28:19', 0),
(58, 'syed.mohammad.saif@gmail.com', '$2y$10$Yb6ik2MU/iH0G.m5Q6ApkOl8c7DpGyO3OOO7Be6DG6GpiMQ/Na1ji', 'SYED MOHD SAIF', 'dealer', '2026-03-25 06:30:39', 0);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `dealers`
--
ALTER TABLE `dealers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `dealer_agreement_acceptance`
--
ALTER TABLE `dealer_agreement_acceptance`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `dealer_id` (`dealer_id`),
  ADD KEY `agreement_version` (`agreement_version`);

--
-- Indexes for table `dealer_applications`
--
ALTER TABLE `dealer_applications`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `dealer_login_otps`
--
ALTER TABLE `dealer_login_otps`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_mobile_created` (`mobile`,`created_at`),
  ADD KEY `idx_expires` (`expires_at`),
  ADD KEY `idx_used` (`used_at`);

--
-- Indexes for table `dealer_payments`
--
ALTER TABLE `dealer_payments`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `dealer_promo_requests`
--
ALTER TABLE `dealer_promo_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_dealer` (`dealer_id`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `order_number` (`order_number`),
  ADD KEY `dealer_id` (`dealer_id`);

--
-- Indexes for table `order_items`
--
ALTER TABLE `order_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `product_id` (`product_id`);

--
-- Indexes for table `otp_logins`
--
ALTER TABLE `otp_logins`
  ADD PRIMARY KEY (`id`),
  ADD KEY `mobile` (`mobile`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `password_resets`
--
ALTER TABLE `password_resets`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_token_hash` (`token_hash`),
  ADD KEY `idx_user_id` (`user_id`);

--
-- Indexes for table `payments`
--
ALTER TABLE `payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `dealer_id` (`dealer_id`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `sku` (`sku`),
  ADD UNIQUE KEY `uniq_products_sku` (`sku`);

--
-- Indexes for table `promo_schemes`
--
ALTER TABLE `promo_schemes`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `security_deposits`
--
ALTER TABLE `security_deposits`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_dealer` (`dealer_id`);

--
-- Indexes for table `tickets`
--
ALTER TABLE `tickets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `dealer_id` (`dealer_id`),
  ADD KEY `product_id` (`product_id`);

--
-- Indexes for table `ticket_activity`
--
ALTER TABLE `ticket_activity`
  ADD PRIMARY KEY (`id`),
  ADD KEY `ticket_id` (`ticket_id`);

--
-- Indexes for table `ticket_attachments`
--
ALTER TABLE `ticket_attachments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `ticket_id` (`ticket_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `dealers`
--
ALTER TABLE `dealers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=58;

--
-- AUTO_INCREMENT for table `dealer_agreement_acceptance`
--
ALTER TABLE `dealer_agreement_acceptance`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `dealer_applications`
--
ALTER TABLE `dealer_applications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=61;

--
-- AUTO_INCREMENT for table `dealer_login_otps`
--
ALTER TABLE `dealer_login_otps`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `dealer_payments`
--
ALTER TABLE `dealer_payments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `dealer_promo_requests`
--
ALTER TABLE `dealer_promo_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=53;

--
-- AUTO_INCREMENT for table `order_items`
--
ALTER TABLE `order_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=72;

--
-- AUTO_INCREMENT for table `otp_logins`
--
ALTER TABLE `otp_logins`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `password_resets`
--
ALTER TABLE `password_resets`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payments`
--
ALTER TABLE `payments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `promo_schemes`
--
ALTER TABLE `promo_schemes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `security_deposits`
--
ALTER TABLE `security_deposits`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `tickets`
--
ALTER TABLE `tickets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `ticket_activity`
--
ALTER TABLE `ticket_activity`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ticket_attachments`
--
ALTER TABLE `ticket_attachments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=59;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `dealers`
--
ALTER TABLE `dealers`
  ADD CONSTRAINT `dealers_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`dealer_id`) REFERENCES `dealers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `order_items`
--
ALTER TABLE `order_items`
  ADD CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `order_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `payments`
--
ALTER TABLE `payments`
  ADD CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`dealer_id`) REFERENCES `dealers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `tickets`
--
ALTER TABLE `tickets`
  ADD CONSTRAINT `tickets_ibfk_1` FOREIGN KEY (`dealer_id`) REFERENCES `dealers` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `tickets_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
