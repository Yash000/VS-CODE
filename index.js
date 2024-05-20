import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import env from "dotenv";
import { dirname } from "path";
import { fileURLToPath } from "url";



const __dirname = dirname(fileURLToPath(import.meta.url));const app = express();
const saltRounds = 10;
env.config();
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
// Set up body-parser middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Set the view engine to EJS
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(passport.initialize());
app.use(passport.session());

const { Pool } = pg;
const db = new Pool({
  connectionString: process.env.POSTGRES_URL,
});
// Define your routes here
app.get("/", async (req, res) => {
  await db.query("SELECT NOW()", (err, res) => {
    if (err) {
      console.log(err);
    }
    console.log(res.rows[0]);
  });
  res.render("home");
});
app.get("/login", async (req, res) => {
  await db.query("SELECT $1", ["LOGIN"], (err, res) => {
    if (err) {
      console.log(err);
    }
    console.log(res.rows[0]);
  });
  res.render("login.ejs");
});
app.get("/register", (req, res) => {
  res.render("register.ejs");
});
app.get("/form", (req, res) => {
  if (req.isAuthenticated()) {
    console.log(req.user.b_name);
    res.render("post_form.ejs", { name: req.user.b_name });
  } else {
    res.redirect("/login");
  }
});
app.get("/dashboard", async(req, res) => {
  if (req.isAuthenticated()) {

    const posts=await db.query("SELECT * FROM posts WHERE user_id=$1",[req.user.id]);
    console.log(posts.rows);
    res.render("dashboard/dashboard.ejs",{posts:posts.rows,name:req.user.b_name});
  } else {
    res.redirect("/login");
  }
});
app.get("/log_out", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});
app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
  })
);
app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;
  const mobile = req.body.mobile;
  const b_name = req.body.business_name;
  const address = req.body.address;
  const google_map_link = req.body.google_map_link;
  console.log(email, password, mobile, b_name, address, google_map_link);
  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (checkResult.rows.length > 0) {
      req.redirect("/login");
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          const result = await db.query(
            "INSERT INTO users (email, password, mobile, b_name, address,google_map_link) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
            [email, hash, mobile, b_name, address, google_map_link]
          );
          const user = result.rows[0];
          req.login(user, (err) => {
            console.log("success");
            res.redirect("/form");
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});
app.post("/form", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const company_data = await db.query(
        "SELECT * FROM users WHERE email=$1",
        [req.user.email]
      );
      const title = req.body.title;
      const description = req.body.description;
      const email = req.user.email;
      const qualification = req.body.qualification;
      const salary = req.body.salary;
      const role = req.body.role;

      console.log(
        company_data.rows[0].id,
        title,
        description,
        email,
        qualification,
        salary,
        role
      );
      const response = await db.query(
        "INSERT INTO posts (user_id, title,role,description, qualification, salary, status) VALUES ($1, $2, $3,$4,$5,$6,$7) RETURNING *",
        [
          company_data.rows[0].id,
          title,
          role,
          description,
          qualification,
          salary,
          "pending",
        ]
      );
      console.log(response.rows[0]);
      res.redirect("/dashboard");
    } catch (err) {
      console.log(err);
      res.redirect("/form");
    }
  } else {
    res.redirect("/login");
  }
});
app.delete("/delete_post/:id", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const response = await db.query("DELETE FROM posts WHERE id=$1", [
        req.params.id,
      ]);
      console.log(response.rows[0]);
      res.json({ok:true});
    } catch (err) {
      console.log(err);
      res.redirect("/dashboard");
    }
  } else {
    res.redirect("/login");
  }
});


// Start the server
app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

passport.use(
  "local",
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1 ", [
        username,
      ]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              return cb(null, user);
            } else {
              return cb(null, false);
            }
          }
        });
      } else {
        return cb("User not found");
      }
    } catch (err) {
      console.log(err);
    }
  })
);

passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secrets",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        const result = await db.query("SELECT * FROM users WHERE email = $1", [
          profile.email,
        ]);
        if (result.rows.length === 0) {
          const newUser = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2)",
            [profile.email, "google"]
          );
          return cb(null, newUser.rows[0]);
        } else {
          return cb(null, result.rows[0]);
        }
      } catch (err) {
        return cb(err);
      }
    }
  )
);
passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});
