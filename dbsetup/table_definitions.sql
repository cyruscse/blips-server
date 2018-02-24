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
	(ID char(255),
		LCID int NOT NULL,
		Type char(30) NOT NULL,
		Name char(100) NOT NULL,
		Rating float(2, 1) NOT NULL,
		Price int NOT NULL,
		IconURL char(100) NOT NULL,
		Latitude float(10, 7) NOT NULL,
		Longitude float(10, 7) NOT NULL,
		PRIMARY KEY (ID, LCID));

create table AttractionTypes
	(ID int AUTO_INCREMENT PRIMARY KEY,
		Name char(30),
		ProperName char(30));

create table Users
	(ID int AUTO_INCREMENT PRIMARY KEY,
		Name char(50),
		Email char(50));

/* UID -> User ID, key into Users table */
/* AID -> Attraction ID, key into Attractions table */
create table UserPreferences
	(UID varchar(255),
		AID int,
		Frequency int,
		PRIMARY KEY (UID, AID));

/* UID -> User ID, key into Users table */
create table UserAutoQueryOptions
	(UID varchar(255) PRIMARY KEY,
		Enabled bool NOT NULL DEFAULT 1,
		TypeGrabLength int NOT NULL DEFAULT 0,
		OpenNow bool NOT NULL DEFAULT 1,
		Rating float(2, 1) NOT NULL DEFAULT '0.0',
		PriceRange int NOT NULL DEFAULT 0);
