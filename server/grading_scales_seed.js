// Default Ugandan Primary/UCE grading boundaries (UCE 9-point scale, lower points better)
module.exports = [
  {grade:'D1', min:80, max:100, points:1, division:'Division 1'},
  {grade:'D2', min:70, max:79,  points:2, division:'Division 1'},
  {grade:'C3', min:60, max:69,  points:3, division:'Division 2'},
  {grade:'C4', min:50, max:59,  points:4, division:'Division 2'},
  {grade:'C5', min:40, max:49,  points:5, division:'Division 3'},
  {grade:'C6', min:35, max:39,  points:6, division:'Division 3'},
  {grade:'P7', min:28, max:34,  points:7, division:'Division 4'},
  {grade:'P8', min:20, max:27,  points:8, division:'Division 4'},
  {grade:'F9', min:0,  max:19,  points:9, division:'Ungraded'}
];