-- Compound — seed content. Run AFTER schema.sql.
-- Safe to re-run: clears content tables first (does NOT touch users/progress).
SET NAMES utf8mb4;
SET foreign_key_checks = 0;
TRUNCATE TABLE quiz_options;
TRUNCATE TABLE quiz_questions;
TRUNCATE TABLE cards;
TRUNCATE TABLE assignments;
TRUNCATE TABLE lessons;
TRUNCATE TABLE paths;
TRUNCATE TABLE book_insights;
TRUNCATE TABLE books;
SET foreign_key_checks = 1;

-- ---------- Books ----------
INSERT INTO books (id, slug, title, author, category, cover_class, blurb, minutes, sort) VALUES
(1,'never-split-the-difference','Never Split the Difference','Chris Voss','Communication','cov1','Negotiation is not logic, it is emotional intelligence. The FBI''s lead hostage negotiator on getting to yes by making people feel understood.',9,1),
(2,'crucial-conversations','Crucial Conversations','Patterson, Grenny, McMillan & Switzler','Communication','cov2','How to talk when stakes are high, opinions differ, and emotions run strong, without damaging the relationship.',11,2),
(3,'made-to-stick','Made to Stick','Chip & Dan Heath','Communication','cov3','Why some ideas survive and others die. Make your message concrete, simple, and impossible to forget.',8,3),
(4,'talk-like-ted','Talk Like TED','Carmine Gallo','Communication','cov5','The nine public-speaking secrets of the world''s top minds, from the best talks ever given.',7,4),
(5,'atomic-habits','Atomic Habits','James Clear','Habits','cov4','Tiny changes, remarkable results. Build good habits and break bad ones with systems, not willpower.',10,5),
(6,'radical-candor','Radical Candor','Kim Scott','Leadership','cov6','Care personally and challenge directly. How to give feedback that helps people grow without being a jerk.',9,6);

INSERT INTO book_insights (book_id, idx, text) VALUES
(1,1,'Tactical empathy: understand the other side before you try to be understood'),
(1,2,'Mirror the last few words to make people expand'),
(1,3,'Label emotions out loud: "It seems like..."'),
(1,4,'"No" is the start of the conversation, not the end'),
(1,5,'Calibrated "how" and "what" questions hand over the problem'),
(2,1,'Start with heart: know what you really want before you open your mouth'),
(2,2,'Watch for silence and violence, the two signs safety has broken down'),
(2,3,'Make it safe so people can say hard things'),
(2,4,'Master your stories, the meaning you add between fact and feeling'),
(2,5,'STATE your path: share facts, tell your story, ask for theirs'),
(3,1,'Simple: find the core and lead with it'),
(3,2,'Unexpected: break a pattern to grab attention'),
(3,3,'Concrete: paint a picture people can see and touch'),
(3,4,'Credible: let people test the idea themselves'),
(3,5,'Stories: the closest thing to a flight simulator for the mind'),
(4,1,'Unleash the master within: passion is contagious'),
(4,2,'Stick to the 18-minute rule, the brain tunes out after that'),
(4,3,'Teach one memorable, tweetable headline'),
(4,4,'Paint a mental picture with vivid, novel examples'),
(5,1,'Habits are the compound interest of self-improvement'),
(5,2,'The 2-minute rule: make a new habit take under two minutes to start'),
(5,3,'Make it obvious, attractive, easy, and satisfying'),
(5,4,'You do not rise to your goals, you fall to your systems'),
(6,1,'Care personally AND challenge directly, at the same time'),
(6,2,'Praise in public, criticize in private, and be specific'),
(6,3,'Ask for feedback before you give it'),
(6,4,'Silence is the enemy, ruinous empathy helps no one');

-- ---------- Path ----------
INSERT INTO paths (id, slug, title, subtitle, goal, description) VALUES
(1,'communicate-with-impact','Communicate with Impact','From 6 books, sequenced for a manager who is sharpening','Communication','A 12-lesson path drawn from the best communication books, teaching you to listen, ask, and speak so people actually move.');

-- ---------- Lessons ----------
INSERT INTO lessons (id, path_id, idx, title, source_book_id, est_minutes, mission_line) VALUES
(1,1,1,'Listen so people feel heard',2,10,'Give someone your full attention for one whole conversation'),
(2,1,2,'Label the emotion in the room',1,10,'Name one feeling out loud before solving the problem'),
(3,1,3,'Ask questions that open people up',1,10,'Ask a question you do not know the answer to'),
(4,1,4,'Make your point concrete',3,10,'Turn one abstract idea into a picture people can see'),
(5,1,5,'State your path in hard talks',2,12,'Raise one hard topic using facts before feelings'),
(6,1,6,'Structure a talk that lands',4,10,'Cut your next update to one headline and 18 minutes');

-- ---------- Cards ----------
-- Lesson 1
INSERT INTO cards (lesson_id, idx, heading, body, quote, callout_title, callout_body, source_label) VALUES
(1,1,'Most people listen to reply, not to understand.','While the other person talks, we rehearse our comeback. They can feel it, and they hold back. Real listening means going quiet inside so you can actually take in what they mean.',NULL,NULL,NULL,'Crucial Conversations'),
(1,2,'Safety is the precondition for honesty.','People only say what they really think when they feel it is safe. The moment they sense judgment or attack, they go silent or get defensive. Your job first is to make the space safe.',NULL,NULL,NULL,'Crucial Conversations'),
(1,3,'Your turn today.','In your next conversation, do not plan your reply while they talk. Just listen to understand, then summarise what you heard before adding anything.',NULL,'Today''s action','Have one conversation where you listen fully and reflect back what you heard first.','You have the concept, now apply it');
-- Lesson 2
INSERT INTO cards (lesson_id, idx, heading, body, quote, callout_title, callout_body, source_label) VALUES
(2,1,'Name the emotion and it loosens its grip.','Voss calls it labeling. When you say the feeling out loud, the other person feels seen, and the intensity drops. Unlabeled emotions keep running the conversation from underneath.',NULL,NULL,NULL,'Never Split the Difference'),
(2,2,'Start labels with "It seems like".','Not "You are angry" (accusing) but "It seems like this timeline feels unfair." A soft label invites them to correct or confirm, and either way they open up.','"It sounds like you are worried this will fall on your team again."',NULL,NULL,'Never Split the Difference'),
(2,3,'Your turn today.','When someone is tense, resist fixing it. First label what you sense: "It seems like..." Then go quiet and let them respond.',NULL,'Today''s action','Use one emotion label in a real conversation and notice how the temperature changes.','You have the concept, now apply it');
-- Lesson 3 (matches prototype)
INSERT INTO cards (lesson_id, idx, heading, body, quote, callout_title, callout_body, source_label) VALUES
(3,1,'People open up when they feel understood, not interrogated.','Most of us push our own point. Chris Voss, an ex-FBI negotiator, found the opposite works: make the other person feel heard first, and they stop defending and start telling you what is really going on.',NULL,NULL,NULL,'Never Split the Difference · Chris Voss'),
(3,2,'Mirroring: repeat their last few words.','Echoing their last 1 to 3 words, as a gentle question, makes people expand and explain. It costs nothing and buys you the real reason behind a "no".','"We can''t take on the vendor project this quarter." → "This quarter?"',NULL,NULL,'Never Split the Difference · Chris Voss'),
(3,3,'Ask "How" and "What", never "Why".','"Why" makes people defensive. Calibrated questions hand them the problem to solve with you.',NULL,'Try these','"How am I supposed to do that?" · "What is the biggest challenge you face?" · "What about this matters most to you?"','Never Split the Difference · Chris Voss'),
(3,4,'Your turn today.','In your next 1:1 or meeting, when someone pushes back, resist explaining. Instead mirror their last words, then ask one calibrated question.',NULL,'Today''s action','Use one calibrated question in a real conversation and note what changed.','You have the concept, now apply it');
-- Lesson 4
INSERT INTO cards (lesson_id, idx, heading, body, quote, callout_title, callout_body, source_label) VALUES
(4,1,'Abstract ideas slide off. Concrete ones stick.','"Improve customer experience" means nothing. "Answer every email within one hour" is something a person can picture and do. The Heath brothers found concreteness is what makes ideas memorable and actionable.',NULL,NULL,NULL,'Made to Stick'),
(4,2,'Use the tangible: numbers, objects, actions.','Swap jargon for things people can see. Not "leverage synergies" but "the sales team and support team share one call each week." Specifics travel; abstractions evaporate.',NULL,NULL,NULL,'Made to Stick'),
(4,3,'Your turn today.','Take one vague thing you have been saying and rewrite it as a concrete action or image someone could act on tomorrow.',NULL,'Today''s action','Turn one abstract point into a concrete example in a real message or meeting.','You have the concept, now apply it');
-- Lesson 5
INSERT INTO cards (lesson_id, idx, heading, body, quote, callout_title, callout_body, source_label) VALUES
(5,1,'In hard talks, lead with facts, not conclusions.','We jump to "You are unreliable." The other person hears an attack and fights back. Facts are the least controversial, most persuasive place to start.',NULL,NULL,NULL,'Crucial Conversations'),
(5,2,'The STATE path.','Share your facts. Tell your story tentatively. Ask for their path. Talk tentatively. Encourage testing. It lets you say hard things while keeping it safe.',NULL,'The steps','Share facts → Tell your story → Ask for theirs → Talk tentatively → Encourage testing','Crucial Conversations'),
(5,3,'Your turn today.','Pick one thing you have been avoiding. Open with the facts only, then share your story as a story, not a verdict.',NULL,'Today''s action','Raise one hard topic starting from facts, and invite their side before concluding.','You have the concept, now apply it');
-- Lesson 6
INSERT INTO cards (lesson_id, idx, heading, body, quote, callout_title, callout_body, source_label) VALUES
(6,1,'One idea, not ten.','The best TED talks teach a single memorable thing. Gallo calls it the tweetable headline. If your audience can only remember one line, decide now what it should be.',NULL,NULL,NULL,'Talk Like TED'),
(6,2,'Respect the 18-minute rule.','The brain fades after about 18 minutes of listening. Shorter forces you to cut to what matters and leaves people wanting more, not checking the clock.',NULL,NULL,NULL,'Talk Like TED'),
(6,3,'Your turn today.','Before your next update, write the one headline you want people to repeat. Cut anything that does not serve it.',NULL,'Today''s action','Deliver one update built around a single headline, in under 18 minutes.','You have the concept, now apply it');

-- ---------- Quiz questions & options ----------
-- Lesson 1
INSERT INTO quiz_questions (id, lesson_id, idx, question, explanation) VALUES
(1,1,1,'What does it mean to "listen to understand"?','You take in their meaning first instead of rehearsing your reply while they speak.'),
(2,1,2,'Why does safety matter in a conversation?','People only say what they really think when they feel it is safe from judgment or attack.'),
(3,1,3,'A good way to show you understood is to…','Summarise what you heard before adding your own point.');
INSERT INTO quiz_options (question_id, idx, label, is_correct) VALUES
(1,1,'Plan your rebuttal while they talk',0),(1,2,'Take in their meaning before replying',1),(1,3,'Interrupt to speed things up',0),(1,4,'Change the subject to your point',0),
(2,1,'It makes people say what they really think',1),(2,2,'It makes the meeting shorter',0),(2,3,'It lets you win the argument',0),(2,4,'It has no real effect',0),
(3,1,'Immediately give your opinion',0),(3,2,'Summarise what you heard first',1),(3,3,'Point out where they are wrong',0),(3,4,'Stay silent and move on',0);
-- Lesson 2
INSERT INTO quiz_questions (id, lesson_id, idx, question, explanation) VALUES
(4,2,1,'What is "labeling" in Voss''s method?','Naming the emotion out loud so the person feels seen and the intensity drops.'),
(5,2,2,'Which phrasing is a good label?','A tentative "It seems like…" invites them to confirm or correct, without accusing.'),
(6,2,3,'After you label an emotion, you should…','Go quiet and let them respond.');
INSERT INTO quiz_options (question_id, idx, label, is_correct) VALUES
(4,1,'Telling people how to feel',0),(4,2,'Naming the emotion out loud',1),(4,3,'Ignoring emotions to stay logical',0),(4,4,'Matching their anger',0),
(5,1,'"You are being difficult"',0),(5,2,'"It seems like this feels unfair"',1),(5,3,'"Why are you upset?"',0),(5,4,'"Calm down"',0),
(6,1,'Immediately propose a fix',0),(6,2,'Go quiet and let them respond',1),(6,3,'Change the topic',0),(6,4,'Repeat the label louder',0);
-- Lesson 3 (matches prototype)
INSERT INTO quiz_questions (id, lesson_id, idx, question, explanation) VALUES
(7,3,1,'What does "mirroring" mean in Voss''s method?','Echo their final 1 to 3 words as a gentle question, it makes people expand and reveal the real reason.'),
(8,3,2,'A teammate says: "We can''t take this on this quarter." Best mirror?','Mirroring their last words invites them to keep talking, without pressure or blame.'),
(9,3,3,'Which question type tends to make people defensive?','"Why" feels accusatory. "How" and "What" hand the person the problem to solve with you.'),
(10,3,4,'The goal of tactical empathy is to…','When people feel understood, they stop defending and start telling you what is really going on.');
INSERT INTO quiz_options (question_id, idx, label, is_correct) VALUES
(7,1,'Copy the person''s body language',0),(7,2,'Repeat their last 1 to 3 words as a question',1),(7,3,'Agree with everything they say',0),(7,4,'Summarise the whole conversation',0),
(8,1,'"Why not?"',0),(8,2,'"Okay, I''ll do it myself."',0),(8,3,'"This quarter?"',1),(8,4,'"You always say that."',0),
(9,1,'"What" questions',0),(9,2,'"How" questions',0),(9,3,'Calibrated questions',0),(9,4,'"Why" questions',1),
(10,1,'Make the other person feel understood first',1),(10,2,'Win the argument quickly',0),(10,3,'Hide your real intentions',0),(10,4,'Keep all emotion out of it',0);
-- Lesson 4
INSERT INTO quiz_questions (id, lesson_id, idx, question, explanation) VALUES
(11,4,1,'Why do concrete ideas stick better than abstract ones?','People can picture and act on something concrete, abstractions evaporate.'),
(12,4,2,'Which is the more concrete goal?','A specific, observable action beats a vague aspiration.'),
(13,4,3,'To make an idea concrete you should…','Use tangible numbers, objects, or actions people can see.');
INSERT INTO quiz_options (question_id, idx, label, is_correct) VALUES
(11,1,'They sound more professional',0),(11,2,'People can picture and act on them',1),(11,3,'They are shorter',0),(11,4,'They avoid commitment',0),
(12,1,'"Improve customer experience"',0),(12,2,'"Answer every email within one hour"',1),(12,3,'"Leverage synergies"',0),(12,4,'"Be more strategic"',0),
(13,1,'Add more jargon',0),(13,2,'Use tangible numbers and actions',1),(13,3,'Keep it vague on purpose',0),(13,4,'Speak faster',0);
-- Lesson 5
INSERT INTO quiz_questions (id, lesson_id, idx, question, explanation) VALUES
(14,5,1,'In a hard conversation you should open with…','Facts are the least controversial, most persuasive starting point.'),
(15,5,2,'What does the T in STATE stand for here?','Tell your story, tentatively, as a story rather than a verdict.'),
(16,5,3,'Sharing your story "tentatively" means…','You hold it as one interpretation and invite theirs.');
INSERT INTO quiz_options (question_id, idx, label, is_correct) VALUES
(14,1,'Your conclusion about them',0),(14,2,'The facts',1),(14,3,'An apology',0),(14,4,'A threat',0),
(15,1,'Tell your story',1),(15,2,'Take control',0),(15,3,'Threaten consequences',0),(15,4,'Talk louder',0),
(16,1,'Insisting you are right',0),(16,2,'Holding it as one view and inviting theirs',1),(16,3,'Staying silent',0),(16,4,'Avoiding the topic',0);
-- Lesson 6
INSERT INTO quiz_questions (id, lesson_id, idx, question, explanation) VALUES
(17,6,1,'What is a "tweetable headline"?','The one memorable idea you want the audience to repeat.'),
(18,6,2,'What is the 18-minute rule?','Attention fades after about 18 minutes, so keep it short and focused.'),
(19,6,3,'How many core ideas should one talk teach?','One. The best talks teach a single memorable thing.');
INSERT INTO quiz_options (question_id, idx, label, is_correct) VALUES
(17,1,'A long detailed summary',0),(17,2,'The one idea you want repeated',1),(17,3,'A list of your credentials',0),(17,4,'The agenda',0),
(18,1,'Talks must be exactly 18 minutes',0),(18,2,'Attention fades after ~18 minutes',1),(18,3,'You get 18 slides',0),(18,4,'Speak for at least 18 minutes',0),
(19,1,'One',1),(19,2,'As many as possible',0),(19,3,'Exactly five',0),(19,4,'Ten',0);

-- ---------- Assignments ----------
INSERT INTO assignments (lesson_id, title, instructions, examples, due_days) VALUES
(1,'Field assignment','Have one conversation where you listen fully, then reflect back what you heard before adding your view. Capture what changed.','Summarise their point in one sentence and ask "did I get that right?"',2),
(2,'Field assignment','Use one emotion label in a real, slightly tense conversation, then capture how the temperature changed.','Try: "It seems like this deadline feels unfair." Then stay quiet.',2),
(3,'Field assignment','Use one calibrated question in a real 1:1 or meeting, then capture what happened.','e.g. "How am I supposed to do that?" or "What is the biggest challenge here?" then stay quiet and listen.',2),
(4,'Field assignment','Take one abstract point you keep making and deliver it as a concrete example. Capture the reaction.','Swap "improve quality" for a specific, observable action.',2),
(5,'Field assignment','Raise one hard topic you have been avoiding, opening with facts and inviting their side. Capture how it went.','Start: "Here is what I noticed…" before any conclusion.',2),
(6,'Field assignment','Give one update built around a single headline, in under 18 minutes. Capture whether it landed.','Write the one line you want repeated, cut the rest.',2);
