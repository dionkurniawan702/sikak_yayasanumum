const axios = require('axios');
axios.post('http://localhost:5000/api/sync', {
  bosAllocations: [
    {
      id: 'test',
      unitId: 'unit1',
      stageId: 'stage1',
      posId: 'pos1',
      academicYearId: 'year1',
      amount: 1000
    }
  ]
}).then(r => console.log(JSON.stringify(r.data, null, 2)))
  .catch(e => console.error(e.response ? e.response.data : e.message));
