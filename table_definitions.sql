create database blips;

use blips;

create table Country
	(ID int AUTO_INCREMENT PRIMARY KEY,
		Name char(25) NOT NULL);

create table Province
	(ID int AUTO_INCREMENT PRIMARY KEY,
		Name char(25) NOT NULL,
		CID int NOT NULL);

create table City
	(ID int AUTO_INCREMENT PRIMARY KEY,
		Name char(25) NOT NULL,
		PID int,
		CID int NOT NULL);
