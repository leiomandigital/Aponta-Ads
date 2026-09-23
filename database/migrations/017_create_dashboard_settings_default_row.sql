-- dashboard_settings é single-row por design (single-tenant) — esta
-- migration garante que a linha já existe desde o início. A tela de Marca
-- sempre faz UPDATE nessa linha única, nunca INSERT.
insert into dashboard_settings (client_logo_url, brand_primary_color) values (null, null);
