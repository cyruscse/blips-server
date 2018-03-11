create database blips;

use blips;

create table LocationCache
	(city char(50) NOT NULL,
		state char(50),
		country char(50) NOT NULL,
		Type char(30) NOT NULL,
		CachedTime TIMESTAMP NOT NULL,
		ID int AUTO_INCREMENT PRIMARY KEY);

create table AttractionTypes
	(ID int AUTO_INCREMENT PRIMARY KEY,
		Name char(30),
		ProperName char(30));

create table UserSavedBlips
	(UID int,
		BID char(255) NOT NULL,
		PRIMARY KEY (UID, BID));

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

create table Users
	(ID int AUTO_INCREMENT PRIMARY KEY,
		Name char(50),
		Email char(50));

create table UserPreferences
	(UID int,
		AID int,
		Frequency int,
		PRIMARY KEY (UID, AID));

create table UserAutoQueryOptions
	(UID int PRIMARY KEY,
		Enabled bool NOT NULL DEFAULT 1,
		TypeGrabLength int NOT NULL DEFAULT 0,
		OpenNow bool NOT NULL DEFAULT 1,
		Rating float(2, 1) NOT NULL DEFAULT '0.0',
		PriceRange int NOT NULL DEFAULT 0);

