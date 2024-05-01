drop table if exists frequentblock;
drop table if exists wellconditionsimilarity;
drop table if exists wellcondition_factor_link;
drop table if exists wellcondition;
drop table if exists screen;
drop table if exists stock_hazard_link;
drop table if exists hazard;
drop table if exists stock;
drop table if exists frequentstock;
drop table if exists factor;
drop table if exists chemical_class_link;
drop table if exists class;
drop table if exists substitute;
drop table if exists alias;
drop table if exists chemical;

create table chemical (
	id int not null auto_increment,
	name varchar(64),
	unit varchar(8),
	formula varchar(128),
	density decimal(10,2),
	solubility decimal(10,2),
	pka1 decimal(10,2),
	pka2 decimal(10,2),
	pka3 decimal(10,2),
	molecular_weight decimal(10,2),
	ions varchar(64),
	chemical_abstracts_db_id varchar(32),
	critical_micelle_concentration decimal(10,2),
	smiles varchar(128),

	PRIMARY KEY(id),
	INDEX(id)
);

create table alias (
	id int not null auto_increment,
	name varchar(64),
	chemical_id int not null,

	PRIMARY KEY(id),
	INDEX(id),
	INDEX(chemical_id),
	FOREIGN KEY(chemical_id)
		REFERENCES chemical(id)
		ON DELETE CASCADE
);

create table substitute (
	id int not null auto_increment,
	chemical1_id int not null,
	chemical2_id int not null,

	PRIMARY KEY(id),
	INDEX(id),
	INDEX(chemical1_id),
	INDEX(chemical2_id),
	FOREIGN KEY(chemical1_id)
		REFERENCES chemical(id)
		ON DELETE CASCADE,
	FOREIGN KEY(chemical2_id)
		REFERENCES chemical(id)
		ON DELETE CASCADE
);

create table class (
	id int not null auto_increment,
	name varchar(64),

	PRIMARY KEY(id),
	INDEX(id)
);

create table chemical_class_link (
	chemical_id int not null,
	class_id int not null,

	PRIMARY KEY(chemical_id, class_id),
	INDEX(chemical_id, class_id),
	INDEX(chemical_id),
	INDEX(class_id),
	FOREIGN KEY(chemical_id)
		REFERENCES chemical(id)
		ON DELETE CASCADE,
	FOREIGN KEY(class_id)
		REFERENCES class(id)
		ON DELETE CASCADE
);

create table factor (
	id int not null,
	chemical_id int not null,
	concentration decimal(10,2),
	unit varchar(8),
	ph decimal(10,2),

	PRIMARY KEY(id),
	INDEX(id),
	INDEX(chemical_id),
	FOREIGN KEY(chemical_id)
		REFERENCES chemical(id)
		ON DELETE CASCADE
);

create table frequentstock (
	chemical_id int not null,
	concentration decimal(10,2),
	unit varchar(8),
	precipitation_concentration decimal(10,2),

	PRIMARY KEY(chemical_id, concentration, unit, precipitation_concentration),
	INDEX(chemical_id, concentration, unit, precipitation_concentration),
	INDEX(chemical_id),
	FOREIGN KEY(chemical_id)
		REFERENCES chemical(id)
		ON DELETE CASCADE
);

create table stock (
	id int not null auto_increment,
	factor_id int,
	name varchar(64),
	polar tinyint,
	viscosity int,
	volatility int,
	density decimal(10,2),
	available tinyint,
	creator varchar(64),
	creation_date datetime,
	lifetime_in_days int,
	location varchar(64),
	comments varchar(256),

	PRIMARY KEY(id),
	INDEX(id),
	INDEX(factor_id),
	FOREIGN KEY(factor_id)
		REFERENCES factor(id)
		ON DELETE CASCADE
		ON UPDATE RESTRICT
);

create table hazard (
	id int not null auto_increment,
	name varchar(64),
	
	primary KEY(id)
);

create table stock_hazard_link (
	stock_id int not null,
	hazard_id int not null,

	PRIMARY KEY(stock_id, hazard_id),
	INDEX(stock_id, hazard_id),
	INDEX(stock_id),
	INDEX(hazard_id),
	FOREIGN KEY(stock_id)
		REFERENCES stock(id)
		ON DELETE CASCADE,
	FOREIGN KEY(hazard_id)
		REFERENCES hazard(id)
		ON DELETE CASCADE
);

create table screen (
	id int not null auto_increment,
	name varchar(64),
	creator varchar(64),
	creation_date datetime,
	format_name varchar(64),
	format_rows int,
	format_cols int,
	comments varchar(1024),
	
	PRIMARY KEY(id),
	INDEX(id)
);

create table wellcondition (
	id int not null auto_increment,
	screen_id int not null,
	position_number int,
	label varchar(8),
	computed_similarities tinyint,

	PRIMARY KEY(id),
	INDEX(id),
	INDEX(screen_id),
	FOREIGN KEY(screen_id)
		REFERENCES screen(id)
		ON DELETE CASCADE
);

create table wellcondition_factor_link (
	wellcondition_id int not null,
	factor_id int,
	class_id int,

	PRIMARY KEY(wellcondition_id, factor_id, class_id),
	INDEX(wellcondition_id, factor_id, class_id),
	INDEX(wellcondition_id),
	INDEX(factor_id),
	INDEX(class_id),
	FOREIGN KEY(wellcondition_id)
		REFERENCES wellcondition(id)
		ON DELETE CASCADE,
	FOREIGN KEY(factor_id)
		REFERENCES factor(id)
		ON DELETE CASCADE
		ON UPDATE RESTRICT,
	FOREIGN KEY(class_id)
		REFERENCES class(id)
		ON DELETE CASCADE
);

create table wellconditionsimilarity (
	id int not null auto_increment,
	wellcondition1_id int not null,
	wellcondition2_id int not null,
	similarity decimal(10,2),

	PRIMARY KEY(id),
	INDEX(id),
	INDEX(wellcondition1_id),
	INDEX(wellcondition2_id),
	FOREIGN KEY(wellcondition1_id)
		REFERENCES wellcondition(id)
		ON DELETE CASCADE,
	FOREIGN KEY(wellcondition2_id)
		REFERENCES wellcondition(id)
		ON DELETE CASCADE
);

create table frequentblock (
	screen_id int not null,
	reservoir_volume decimal(10,2),
	solution_volume decimal(10,2),

	PRIMARY KEY(screen_id, reservoir_volume, solution_volume),
	INDEX(screen_id, reservoir_volume, solution_volume),
	INDEX(screen_id),
	FOREIGN KEY(screen_id)
		REFERENCES screen(id)
		ON DELETE CASCADE
);