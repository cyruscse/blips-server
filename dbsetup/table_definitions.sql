create database blips;

use blips;

create table Blips
	(ID char(50) PRIMARY KEY,
		Type char(100) NOT NULL,
		Name char(100) NOT NULL,
		Latitude float(10, 7) NOT NULL,
		Longitude float(10, 7) NOT NULL,
		Rating float
		);

create table AttractionTypes
	(ID int AUTO_INCREMENT PRIMARY KEY,
		Name char(30));
