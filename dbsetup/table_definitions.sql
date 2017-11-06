drop database blips;

create database blips;

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

create table Blips
	(ID char(50) PRIMARY KEY,
		BID int NOT NULL,
		Type char(100) NOT NULL,
		Name char(100) NOT NULL,
		Latitude float(10, 7) NOT NULL,
		Longitude float(10, 7) NOT NULL,
		Rating float
		);
