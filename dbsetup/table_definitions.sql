create database blips;

use blips;

create table LocationCache
	(city char(50) NOT NULL,
		state char(50),
		country char(50) NOT NULL,
		Type char(30) NOT NULL,
		CachedTime TIMESTAMP NOT NULL,
		ID int AUTO_INCREMENT PRIMARY KEY);

create table Blips
	(ID char(50),
		LCID int NOT NULL,
		Type char(30) NOT NULL,
		Name char(100) NOT NULL,
		Latitude float(10, 7) NOT NULL,
		Longitude float(10, 7) NOT NULL,
		PRIMARY KEY (ID, LCID));

/* Add text reviews to Reviews table */
/* BID -> Blip ID, key into Blips table */
create table Reviews
	(BID char(50) PRIMARY KEY,
		Rating float);

create table AttractionTypes
	(ID int AUTO_INCREMENT PRIMARY KEY,
		Name char(30));

create table Users
	(ID varchar(255) PRIMARY KEY,
		Name char(50),
		Email char(50));

/* UID -> User ID, key into Users table */
/* AID -> Attraction ID, key into Attractions table */
create table UserPreferences
	(UID varchar(255),
		AID int,
		Frequency int,
		PRIMARY KEY (UID, AID));
