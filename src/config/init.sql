-- 1. Game
CREATE TABLE game (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(100) NOT NULL,
  content_version  INT DEFAULT 1,
  status           VARCHAR(20) DEFAULT 'open'
                   CHECK (status IN ('open', 'freeze'))
);

-- 2. Game_details
CREATE TABLE game_details (
  id          SERIAL PRIMARY KEY,
  description TEXT,
  min_players INT DEFAULT 3,
  game_id     INT REFERENCES game(id) ON DELETE CASCADE
);

-- 3. Judge_categories
CREATE TABLE judge_categories (
  id      SERIAL PRIMARY KEY,
  name    VARCHAR(50) NOT NULL,
  game_id INT REFERENCES game(id) ON DELETE CASCADE
);

-- 4. Judge_details
CREATE TABLE judge_details (
  id                   SERIAL PRIMARY KEY,
  judge_categories_id  INT REFERENCES judge_categories(id) ON DELETE CASCADE,
  description          TEXT NOT NULL,
  status               VARCHAR(10) DEFAULT 'on'
                       CHECK (status IN ('on', 'off'))
);

-- 5. Rules_details
CREATE TABLE rules_details (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100),
  description TEXT,
  game_id     INT REFERENCES game(id) ON DELETE CASCADE
);

-- 6. Card (now holds card type info)
CREATE TABLE card (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(50) NOT NULL,
  emoji         VARCHAR(20),
  score         DECIMAL(3,1) NOT NULL,
  quantity      INT DEFAULT 10,
  detailed_desc TEXT,
  abstract_desc TEXT,
  game_id       INT REFERENCES game(id) ON DELETE CASCADE
);

-- 8. Card_categories (before card_details — needed for FK)
CREATE TABLE card_categories (
  id      SERIAL PRIMARY KEY,
  game_id INT REFERENCES game(id) ON DELETE CASCADE
);

-- 9. Card_categories_details
CREATE TABLE card_categories_details (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  emoji         VARCHAR(10),
  categories_id INT REFERENCES card_categories(id) ON DELETE CASCADE
);

-- 10. Stickers_categories
CREATE TABLE stickers_categories (
  id                         SERIAL PRIMARY KEY,
  card_categories_details_id INT REFERENCES card_categories_details(id) ON DELETE CASCADE,
  sticker_url                TEXT NOT NULL,
  sticker_name               VARCHAR(100),
  created_at                 TIMESTAMP DEFAULT NOW()
);

-- 7. Card_details (after card_categories_details — needs FK)
CREATE TABLE card_details (
  id                         SERIAL PRIMARY KEY,
  card_id                    INT REFERENCES card(id) ON DELETE CASCADE,
  content                    TEXT,
  card_categories_details_id INT REFERENCES card_categories_details(id) ON DELETE CASCADE
);

-- 11. Code
CREATE TABLE code (
  id      SERIAL PRIMARY KEY,
  game_id INT REFERENCES game(id) ON DELETE CASCADE
);

-- 12. Code_details
CREATE TABLE code_details (
  id        SERIAL PRIMARY KEY,
  code_id   INT REFERENCES code(id) ON DELETE CASCADE,
  hash_code VARCHAR(255) UNIQUE NOT NULL,
  status    VARCHAR(10) DEFAULT 'open'
            CHECK (status IN ('open', 'close')),
  used      BOOLEAN DEFAULT FALSE,
  end_date  DATE NULL
);

-- 13. Device
CREATE TABLE device (
  id                     SERIAL PRIMARY KEY,
  device_identifier      VARCHAR(255) NOT NULL,
  restore_code           VARCHAR(255) UNIQUE,
  code_details_id        INT REFERENCES code_details(id),
  device_token           VARCHAR(255) NULL,
  device_token_issued_at TIMESTAMP NULL
);

-- Unique constraint
ALTER TABLE judge_details 
ADD CONSTRAINT judge_details_description_unique UNIQUE (description);

ALTER TABLE card_categories_details
ADD CONSTRAINT card_categories_details_name_categories_unique
UNIQUE (name, categories_id);

-- Game
INSERT INTO game (name, content_version, status)
VALUES ('T3alay', 1, 'open');

-- Game details
INSERT INTO game_details (description, min_players, game_id)
VALUES ('لعبة الكروت الاجتماعية', 3, 1);

-- Judge categories
INSERT INTO judge_categories (name, game_id) VALUES ('enkaz', 1);
INSERT INTO judge_categories (name, game_id) VALUES ('reward', 1);

-- Judge details enkaz
INSERT INTO judge_details (judge_categories_id, description, status) VALUES
(1, 'قلّد صوت حيوان لمدة ١٠ ثواني 🐒', 'on'),
(1, 'اتكلم بلهجة غريبة لحد ما يجي دورك تاني', 'on'),
(1, 'اعمل رقصة قصيرة دلوقتي 💃', 'on'),
(1, 'قول أغرب حاجة اتكلت في حياتك', 'on'),
(1, 'ارقص ١٠ ثوانٍ من غير موسيقى', 'on'),
(1, 'قلّد أي لاعب على الطاولة وهو بيتكلم', 'on'),
(1, 'اعمل ١٥ قرفصاوية دلوقتي', 'on'),
(1, 'غني أول كوبليه من أي أغنية تعرفها', 'on');

-- Judge details reward
INSERT INTO judge_details (judge_categories_id, description, status) VALUES
(2, 'هاتوله شاورما 🌯', 'on'),
(2, 'هو الزعيم الرسمي لباقي السهرة 👑', 'on'),
(2, 'الجولة الجاية على حساب الكل احتفالًا بيه', 'on'),
(2, 'معفي من غسيل الأكواب الليلة 🍽️', 'on'),
(2, 'الكل يصفّق له تصفيق مكسيكي كامل 🙌', 'on');

-- Card types (kariokle / 8nely / enkaz)
INSERT INTO card (name, emoji, score, quantity, game_id) VALUES
('kariokle', '🎵', 0.5,  10, 1),
('8nely',    '🔱', 1.0,  10, 1),
('enkaz',    '😈', -1.0, 10, 1);

-- Card categories
INSERT INTO card_categories (game_id) VALUES (1);

-- Card categories details
INSERT INTO card_categories_details (name, emoji, categories_id) VALUES
('عاطفي',   '❤️', 1),
('مضحك',    '😂', 1),
('جريء',    '🔥', 1),
('اجتماعي', '🧑‍🤝‍🧑', 1);

-- Rules
INSERT INTO rules_details (name, description, game_id) VALUES
('كرت الإنقاذ',  'متاح مرة واحدة لكل لاعب في اللعبة', 1),
('الفائز',       'اللاعب الأعلى نقاطاً في نهاية الجولات', 1),
('الحد الأدنى',  'لازم يكون في ٣ لاعبين على الأقل', 1);