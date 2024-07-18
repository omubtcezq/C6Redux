drop table if exists wellconditionsimilarity;
drop table if exists wellcondition_factor_link;
drop table if exists well;
drop table if exists wellcondition;
drop table if exists frequentblock;
drop table if exists screen;
drop table if exists phpoint;
drop table if exists phcurve;
drop table if exists stock_hazard_link;
drop table if exists hazard;
drop table if exists stock;
drop table if exists factor;
drop table if exists chemical_substitute_link;
drop table if exists substitute;
drop table if exists alias;
drop table if exists frequentstock;
drop table if exists chemical;

create table chemical (
	id int not null auto_increment,
	name varchar(64),
	unit varchar(8),
	formula varchar(128),
	density double,
	solubility double,
	pka1 double,
	pka2 double,
	pka3 double,
	molecular_weight double,
	ions varchar(64),
	monomer varchar(64),
	chemical_abstracts_db_id varchar(32),
	critical_micelle_concentration double,
	smiles varchar(128),

	PRIMARY KEY(id),
	INDEX(id)
);

create table frequentstock (
	chemical_id int not null,
	concentration double,
	unit varchar(8),
	precipitation_concentration double,

	PRIMARY KEY(chemical_id),
	INDEX(chemical_id),
	FOREIGN KEY(chemical_id)
		REFERENCES chemical(id)
		ON DELETE CASCADE
);

create table alias (
	id int not null auto_increment,
	name varchar(128),
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
	name varchar(128),

	PRIMARY KEY(id),
	INDEX(id)
);

create table chemical_substitute_link (
	chemical_id int not null,
	substitute_id int not null,

	PRIMARY KEY(chemical_id, substitute_id),
	INDEX(chemical_id, substitute_id),
	INDEX(chemical_id),
	INDEX(substitute_id),
	FOREIGN KEY(chemical_id)
		REFERENCES chemical(id)
		ON DELETE CASCADE,
	FOREIGN KEY(substitute_id)
		REFERENCES substitute(id)
		ON DELETE CASCADE
);

create table factor (
	id int not null auto_increment,
	chemical_id int not null,
	concentration double,
	unit varchar(8),
	ph double,

	PRIMARY KEY(id),
	INDEX(id),
	INDEX(chemical_id),
	FOREIGN KEY(chemical_id)
		REFERENCES chemical(id)
		ON DELETE CASCADE
);

create table stock (
	id int not null auto_increment,
	factor_id int not null,
	name varchar(64),
	polar tinyint,
	viscosity int,
	volatility int,
	density double,
	available tinyint,
	creator varchar(64),
	location varchar(64),
	comments varchar(1024),

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

create table phcurve (
	id int not null auto_increment,
	chemical_id int not null,
	low_range double not null,
	low_chemical_id int not null,
	high_range double not null,
	high_chemical_id int not null,
	hh tinyint not null,

	PRIMARY KEY(id),
	INDEX(id),
	INDEX(chemical_id),
	INDEX(low_chemical_id),
	INDEX(high_chemical_id),
	FOREIGN KEY(chemical_id)
		REFERENCES chemical(id)
		ON DELETE CASCADE,
	FOREIGN KEY(low_chemical_id)
		REFERENCES chemical(id)
		ON DELETE RESTRICT,
	FOREIGN KEY(high_chemical_id)
		REFERENCES chemical(id)
		ON DELETE RESTRICT
);

create table phpoint (
	id int not null auto_increment,
	phcurve_id int not null,
	high_chemical_percentage double not null,
	result_ph double not null,

	PRIMARY KEY(id),
	INDEX(id),
	INDEX(phcurve_id),
	FOREIGN KEY(phcurve_id)
		REFERENCES phcurve(id)
		ON DELETE CASCADE 
);

create table screen (
	id int not null auto_increment,
	name varchar(64),
	owned_by varchar(64),
	creation_date datetime,
	format_name varchar(64),
	format_rows int,
	format_cols int,
	comments varchar(1024),
	
	PRIMARY KEY(id),
	INDEX(id)
);

create table frequentblock (
	screen_id int not null,
	reservoir_volume double,
	solution_volume double,

	PRIMARY KEY(screen_id),
	INDEX(screen_id),
	FOREIGN KEY(screen_id)
		REFERENCES screen(id)
		ON DELETE CASCADE
);

create table wellcondition (
	id int not null auto_increment,
	computed_similarities tinyint,

	PRIMARY KEY(id),
	INDEX(id)
);

create table well (
	id int not null auto_increment,
	screen_id int not null,
	wellcondition_id int not null,
	position_number int,
	label varchar(8),

	PRIMARY KEY(id),
	INDEX(id),
	INDEX(screen_id),
	INDEX(wellcondition_id),
	FOREIGN KEY(screen_id)
		REFERENCES screen(id)
		ON DELETE CASCADE,
	FOREIGN KEY(wellcondition_id)
		REFERENCES wellcondition(id)
		ON DELETE RESTRICT
);

create table wellcondition_factor_link (
	wellcondition_id int not null,
	factor_id int not null,

	PRIMARY KEY(wellcondition_id, factor_id),
	INDEX(wellcondition_id, factor_id),
	INDEX(wellcondition_id),
	INDEX(factor_id),
	FOREIGN KEY(wellcondition_id)
		REFERENCES wellcondition(id)
		ON DELETE CASCADE,
	FOREIGN KEY(factor_id)
		REFERENCES factor(id)
		ON DELETE RESTRICT
		ON UPDATE RESTRICT
);

create table wellconditionsimilarity (
	id int not null auto_increment,
	wellcondition_id1 int not null,
	wellcondition_id2 int not null,
	similarity double,

	PRIMARY KEY(id),
	INDEX(id),
	INDEX(wellcondition_id1),
	INDEX(wellcondition_id2),
	FOREIGN KEY(wellcondition_id1)
		REFERENCES wellcondition(id)
		ON DELETE CASCADE,
	FOREIGN KEY(wellcondition_id2)
		REFERENCES wellcondition(id)
		ON DELETE CASCADE
);