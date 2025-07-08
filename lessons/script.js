document.addEventListener('DOMContentLoaded', () => {
  // ===== Упражнения с выбором одной буквы =====
  document.querySelectorAll('.choice-exercise').forEach(section => {
    const letters = section.querySelectorAll('.letter');
    const checkBtn = section.querySelector('.check-button');
    const result = section.querySelector('.result');
    const audio = section.querySelector('audio');
    let selected = null;

    letters.forEach(letter => {
      letter.addEventListener('click', () => {
        letters.forEach(l => l.classList.remove('selected'));
        letter.classList.add('selected');
        selected = letter.textContent.trim();
      });
    });

    checkBtn.addEventListener('click', () => {
      if (!selected) {
        result.textContent = 'Пожалуйста, выберите вариант.';
        result.style.color = 'orange';
        return;
      }
      const correct = section.dataset.correct;
      if (selected === correct) {
        result.textContent = 'Верно!';
        result.style.color = 'green';
      } else {
        result.textContent = 'Неверно. Попробуйте снова.';
        result.style.color = 'red';
      }
    });

    audio.addEventListener('play', () => {
      selected = null;
      letters.forEach(l => l.classList.remove('selected'));
      result.textContent = '';
    });
  });

  // ===== Упражнения с выбором нескольких букв в правильном порядке =====
  document.querySelectorAll('.exercise').forEach(section => {
    const letters = section.querySelectorAll('.letter');
    const checkBtn = section.querySelector('.check-button');
    const result = section.querySelector('.result');
    const audio = section.querySelector('audio');
    const expected = section.dataset.answer.split(',');
    let selected = [];

    letters.forEach(letter => {
      letter.addEventListener('click', () => {
        if (!letter.classList.contains('selected')) {
          letter.classList.add('selected');
          selected.push(letter.textContent.trim());
        }
      });
    });

    checkBtn.addEventListener('click', () => {
      if (selected.length === 0) {
        result.textContent = 'Пожалуйста, выберите буквы.';
        result.style.color = 'orange';
        return;
      }

      const correct = JSON.stringify(selected) === JSON.stringify(expected);
      if (correct) {
        result.textContent = 'Правильно!';
        result.style.color = 'green';
      } else {
        result.textContent = 'Неверно. Попробуйте снова.';
        result.style.color = 'red';
      }
    });

    audio.addEventListener('play', () => {
      selected = [];
      letters.forEach(l => l.classList.remove('selected'));
      result.textContent = '';
    });
  });
});
