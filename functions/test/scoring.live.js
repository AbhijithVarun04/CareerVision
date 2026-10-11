'use strict';
const fs = require('fs');
const path = require('path');
const { scoreCareers } = require('../pipeline/scoringEngine');

const synthesized = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'synthesized.cache.json'), 'utf8')
);
const careers = synthesized.map((c) => ({ ...c, career_name: c.career }));

// Hand-made sample student (tech-leaning). Same 0-10 scale as required_signals.
const student = {
  analytical_thinking: 8, creativity: 6, people_orientation: 4, technical_aptitude: 8,
  leadership: 5, structure_preference: 6, independence_preference: 7, risk_tolerance: 5,
};

const scenarios = {
  'Interest-first': { interest: 0.7, salary: 0.15, demand: 0.15 },
  'Salary-first': { interest: 0.15, salary: 0.7, demand: 0.15 },
  'Demand-first': { interest: 0.15, salary: 0.15, demand: 0.7 },
};

for (const [name, weights] of Object.entries(scenarios)) {
  console.log(`\n== ${name} ==`);
  scoreCareers(student, careers, weights).slice(0, 5).forEach((c) =>
    console.log(
      `${c.rank}. ${c.career_name}  final=${c.final_score}  ` +
      `fit=${c.interest_fit} sal=${c.salary_score} dem=${c.demand_score}`
    )
  );
}