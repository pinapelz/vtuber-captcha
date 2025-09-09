CREATE TABLE vtuber_data
(
    id serial PRIMARY KEY,
    name text,
    affiliation text,
    image_url text
);


CREATE TABLE sessions
(
    session_id varchar(255) PRIMARY KEY,
    answer varchar(255),
    created_at timestamp,
);
