import type { VideoContext } from "./types";

export interface EvalCase {
  text: string;
  expected: string[];
  context?: VideoContext;
}

export const EVAL_CASES: EvalCase[] = [
  {
    text: "I am going to the store tomorrow",
    expected: ["TOMORROW", "STORE", "I", "GO"],
  },
  { text: "The dog is big", expected: ["DOG", "BIG"] },
  { text: "What is your name?", expected: ["YOUR", "NAME", "WHAT"] },
  { text: "I don't understand", expected: ["I", "UNDERSTAND", "NOT"] },
  { text: "My name is Bob", expected: ["MY", "NAME", "FS:BOB"] },
  {
    text: "I went to school yesterday",
    expected: ["YESTERDAY", "SCHOOL", "I", "GO"],
  },
  { text: "I like that movie", expected: ["MOVIE", "THAT", "I", "LIKE"] },
  { text: "The children are happy", expected: ["CHILD", "HAPPY"] },
  { text: "Please help me", expected: ["PLEASE", "HELP", "I"] },
  { text: "I want water", expected: ["I", "WANT", "WATER"] },
  { text: "She bought a large car", expected: ["SHE", "BUY", "BIG", "CAR"] },
  { text: "We are learning today", expected: ["TODAY", "WE", "LEARN"] },
  { text: "Where is your school?", expected: ["YOUR", "SCHOOL", "WHERE"] },
  { text: "I have 12 books", expected: ["I", "HAVE", "FS:12", "BOOKS"] },
  { text: "Hello and thank you", expected: ["HELLO", "THANK-YOU"] },
  { text: "The food is good", expected: ["FOOD", "GOOD"] },
  { text: "My mother is a teacher", expected: ["MY", "MOTHER", "TEACHER"] },
  {
    text: "You need to drink water",
    expected: ["YOU", "NEED", "DRINK", "WATER"],
  },
  { text: "I cannot hear", expected: ["I", "HEAR", "NOT"] },
  { text: "We work together", expected: ["WE", "WORK", "TOGETHER"] },
  { text: "The sun is hot", expected: ["SUN", "HOT"] },
  { text: "I love my family", expected: ["I", "LOVE", "MY", "FAMILY"] },
  { text: "How are you?", expected: ["YOU", "HOW"] },
  { text: "See you tomorrow", expected: ["TOMORROW", "SEE", "YOU"] },
  { text: "The movie starts now", expected: ["MOVIE", "START", "NOW"] },
  {
    text: "The bat is flying",
    expected: ["BAT-ANIMAL", "FLY"],
    context: {
      topic: "Nocturnal mammals",
      names: [],
      terms: [
        { term: "bat", meaning: "a flying mammal, not sports equipment" },
      ],
    },
  },
  {
    text: "We sat by the bank",
    expected: ["WE", "SIT", "RIVER"],
    context: {
      topic: "A walk beside a river",
      names: [],
      terms: [
        {
          term: "bank",
          meaning: "the edge of a river, not a financial institution",
        },
      ],
    },
  },
  {
    text: "The crane is tall",
    expected: ["BIRD", "TALL"],
    context: {
      topic: "Wetland birds",
      names: [],
      terms: [
        {
          term: "crane",
          meaning: "a long-legged bird, not construction machinery",
        },
      ],
    },
  },
  {
    text: "I like java",
    expected: ["I", "LIKE", "COFFEE"],
    context: {
      topic: "Breakfast drinks",
      names: [],
      terms: [
        { term: "java", meaning: "coffee, not the programming language" },
      ],
    },
  },
  {
    text: "We visited mona loa",
    expected: ["WE", "VISIT", "FS:MAUNALOA"],
    context: {
      topic: "Hawaiian volcanoes",
      names: ["Mauna Loa"],
      terms: [],
    },
  },
];

// Evaluation vocabulary is a fixture, not a claim that Hasan has animated these signs.
export const EVAL_DICTIONARY = [
  ...new Set(
    EVAL_CASES.flatMap(({ expected }) =>
      expected.filter((token) => !token.startsWith("FS:")),
    ),
  ),
];
