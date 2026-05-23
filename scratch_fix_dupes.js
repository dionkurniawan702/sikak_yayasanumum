fetch('http://127.0.0.1:5000/api/fix-dist-dupes')
    .then(res => res.json())
    .then(data => console.log(data))
    .catch(err => console.error(err));
