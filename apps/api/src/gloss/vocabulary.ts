import { cleanText, fallbackTokens, SYNONYMS } from "./words";
import type { Caption } from "./types";

export function signCoverage(
  tokens: string[],
  dictionary: ReadonlySet<string>,
) {
  const realSigns = tokens.filter((token) => dictionary.has(token)).length;
  return {
    tokens: tokens.length,
    realSigns,
    fingerspelled: tokens.filter((token) => token.startsWith("FS:")).length,
    coveragePercent: tokens.length ? (100 * realSigns) / tokens.length : 0,
  };
}

// Provisional everyday priorities; demo-caption counts replace this order as recordings arrive.
export const EVERYDAY_WORDS =
  `I YOU MY YOUR WE THEY HE SHE IT HELLO THANK-YOU PLEASE YES NO NOT WANT NEED LIKE LOVE KNOW UNDERSTAND HELP GOOD BAD BIG SMALL MORE ALL SAME DIFFERENT HAVE GO COME SEE LOOK WATCH HEAR SAY TELL ASK ANSWER NAME WHO WHAT WHERE WHEN WHY HOW WHICH NOW TODAY TOMORROW YESTERDAY TIME DAY WEEK MONTH YEAR MORNING NIGHT BEFORE AFTER FINISH START AGAIN WAIT STOP WORK SCHOOL LEARN TEACH TEACHER STUDENT READ WRITE BOOK PAPER WORD LANGUAGE SIGN ENGLISH ASL DEAF HEARING PERSON PEOPLE CHILD MAN WOMAN FRIEND FAMILY MOTHER FATHER BROTHER SISTER BABY HOME HOUSE ROOM DOOR WINDOW TABLE CHAIR BED BATHROOM KITCHEN STORE BUY MONEY COST PAY FOOD EAT DRINK WATER COFFEE TEA MILK BREAD FRUIT APPLE BANANA RICE MEAT FISH VEGETABLE HUNGRY THIRSTY FULL HAPPY SAD ANGRY AFRAID EXCITED TIRED SICK HEALTHY FEEL THINK REMEMBER FORGET CAN CANNOT TRY USE MAKE DO PLAY WALK RUN SIT STAND SLEEP WAKE LIVE VISIT MEET TOGETHER ALONE HERE THERE NEAR FAR LEFT RIGHT UP DOWN IN OUT OPEN CLOSE CAR BUS TRAIN AIRPLANE BIKE ROAD CITY COUNTRY WORLD PLACE MOVE TURN FAST SLOW HOT COLD WARM COOL RAIN SNOW SUN WIND TREE FLOWER ANIMAL DOG CAT BIRD COLOR RED BLUE GREEN YELLOW BLACK WHITE NUMBER ONE TWO THREE FOUR FIVE TEN MANY FEW FIRST LAST NEXT IMPORTANT EASY HARD RIGHT-WRONG TRUE FALSE QUESTION STORY VIDEO MOVIE MUSIC COMPUTER PHONE INTERNET SCIENCE EARTH BODY HAND FACE EYE EAR HEAD HEART LIFE CHANGE GROW BUILD SHOW GIVE TAKE FIND LOSE BRING SEND RECEIVE SHARE THANKS SORRY WELCOME`
    .split(" ")
    .slice(0, 200);

export function rankWords(captions: Caption[]) {
  const counts = new Map<string, number>();
  for (const caption of captions) {
    for (const word of fallbackTokens(cleanText(caption.text))) {
      const canonical = SYNONYMS[word] ?? word;
      if (!/^\d/.test(canonical))
        counts.set(canonical, (counts.get(canonical) ?? 0) + 1);
    }
  }
  return [...new Set([...EVERYDAY_WORDS, ...counts.keys()])]
    .map((word, order) => ({
      word,
      captionCount: counts.get(word) ?? 0,
      order,
    }))
    .sort((a, b) => b.captionCount - a.captionCount || a.order - b.order)
    .slice(0, 200)
    .map(({ word, captionCount }, index) => ({
      rank: index + 1,
      word,
      captionCount,
    }));
}
