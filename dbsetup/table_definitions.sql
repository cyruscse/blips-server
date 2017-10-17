# create database blips; This doesn't work, need to have database created already

use blips;

create table Country
	(ID int AUTO_INCREMENT PRIMARY KEY,
		Name char(25) NOT NULL UNIQUE);

create table Province
	(ID int AUTO_INCREMENT PRIMARY KEY,
		Name char(25) NOT NULL,
		CID int NOT NULL);

create table City
	(ID int AUTO_INCREMENT PRIMARY KEY,
		Name char(25) NOT NULL,
		PID int,
		CID int NOT NULL,
		Updated TIMESTAMP NOT NULL);

create table Lodging
	(ID char(50) PRIMARY KEY,
		BID int NOT NULL,
		Name char(25) NOT NULL,
		Latitude float NOT NULL,
		Longitude float NOT NULL,
		Rating float NOT NULL
		)
