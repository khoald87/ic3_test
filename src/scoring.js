/**
 * Scoring Module
 * Tính điểm bài thi IC3 GS6 Spark Level 1 theo thang 1000
 */

/**
 * So sánh hai mảng có cùng phần tử (không quan tâm thứ tự)
 * @param {number[]} a
 * @param {number[]} b
 * @returns {boolean}
 */
function arraysEqualUnordered(a, b) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  return sortedA.every((val, i) => val === sortedB[i]);
}

/**
 * So sánh hai mảng có cùng phần tử theo đúng thứ tự
 * @param {number[]} a
 * @param {number[]} b
 * @returns {boolean}
 */
function arraysEqualOrdered(a, b) {
  if (a.length !== b.length) return false;
  return a.every((val, i) => val === b[i]);
}

/**
 * Kiểm tra câu trả lời có đúng không
 * @param {number|number[]|null} selectedAnswer
 * @param {number|number[]} correctAnswer
 * @param {string} type - Dạng câu hỏi
 * @returns {boolean}
 */
function isAnswerCorrect(selectedAnswer, correctAnswer, type) {
  if (selectedAnswer === null || selectedAnswer === undefined) {
    return false;
  }

  if (type === 'single-choice' || type === 'true-false') {
    return selectedAnswer === correctAnswer;
  }

  if (type === 'multiple-choice') {
    if (!Array.isArray(selectedAnswer) || !Array.isArray(correctAnswer)) {
      return false;
    }
    return arraysEqualUnordered(selectedAnswer, correctAnswer);
  }

  if (type === 'drag-drop') {
    if (!Array.isArray(selectedAnswer) || !Array.isArray(correctAnswer)) {
      return false;
    }
    return arraysEqualOrdered(selectedAnswer, correctAnswer);
  }

  return false;
}

/**
 * Tính điểm bài thi theo thang 1000
 * @param {Array<{questionId: string, selectedAnswer: number|number[]|null}>} answers
 * @param {Array<Object>} questions - Danh sách câu hỏi từ đề thi
 * @returns {{
 *   totalScore: number,
 *   passed: boolean,
 *   totalQuestions: number,
 *   correctCount: number,
 *   domainScores: {hardware: {correct: number, total: number}, software: {correct: number, total: number}, networking: {correct: number, total: number}},
 *   answers: Array<{questionId: string, selectedAnswer: *, correctAnswer: *, isCorrect: boolean}>
 * }}
 */
function calculateScore(answers, questions) {
  if (!Array.isArray(answers) || !Array.isArray(questions)) {
    return {
      totalScore: 0,
      passed: false,
      totalQuestions: 0,
      correctCount: 0,
      domainScores: {
        hardware: { correct: 0, total: 0 },
        software: { correct: 0, total: 0 },
        networking: { correct: 0, total: 0 }
      },
      answers: []
    };
  }

  const questionMap = new Map();
  for (const q of questions) {
    questionMap.set(q.id, q);
  }

  const domainScores = {
    hardware: { correct: 0, total: 0 },
    software: { correct: 0, total: 0 },
    networking: { correct: 0, total: 0 }
  };

  // Count domain totals from questions
  for (const q of questions) {
    if (domainScores[q.domain]) {
      domainScores[q.domain].total++;
    }
  }

  let correctCount = 0;
  const answerDetails = [];

  for (const answer of answers) {
    const question = questionMap.get(answer.questionId);
    if (!question) {
      answerDetails.push({
        questionId: answer.questionId,
        selectedAnswer: answer.selectedAnswer,
        correctAnswer: null,
        isCorrect: false
      });
      continue;
    }

    const isCorrect = isAnswerCorrect(answer.selectedAnswer, question.correct, question.type);

    if (isCorrect) {
      correctCount++;
      if (domainScores[question.domain]) {
        domainScores[question.domain].correct++;
      }
    }

    answerDetails.push({
      questionId: answer.questionId,
      selectedAnswer: answer.selectedAnswer,
      correctAnswer: question.correct,
      isCorrect
    });
  }

  const totalQuestions = questions.length;
  const totalScore = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 1000) : 0;
  const passed = totalScore >= 700;

  return {
    totalScore,
    passed,
    totalQuestions,
    correctCount,
    domainScores,
    answers: answerDetails
  };
}

module.exports = { calculateScore, isAnswerCorrect };
