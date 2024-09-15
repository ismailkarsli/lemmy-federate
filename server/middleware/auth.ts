import jwt from "jsonwebtoken";

const SECRET_KEY = process.env.SECRET_KEY;
if (!SECRET_KEY) {
	throw new Error("SECRET_KEY is required");
}

export default defineEventHandler((event) => {
	const cookies = parseCookies(event);
	const token = cookies.token;
	if (token) {
		try {
			const user = jwt.verify(token, SECRET_KEY);
			event.context.auth = user;
		} catch (e) {
			console.error(e);
		}
	}
});
