
import bodyParser from 'body-parser';     
import express from 'express';

const app = express();
const port = 4000;
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Set the view engine to EJS
app.get('/', (req, res) => {
    res.send('Hello World!');
});
app.post('/form', async(req, res) => {
    const post = await {
        title: req.body.title,
        description: req.body.description,
        email: req.body.email,
        qualification: req.body.qualification,
        salary: req.body.salary,
      };
      console.log(post);
      res.json(post);
}
);
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});