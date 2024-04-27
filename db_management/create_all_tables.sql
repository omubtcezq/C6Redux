create table screen (
	id int not null auto_increment,
	name varchar(64),
	username varchar(64),
	format_name varchar(64),
	format_rows int,
	format_cols int,
	format_subs int,
	comments varchar(1024),
	primary key (id)
);