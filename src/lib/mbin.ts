import ky from "ky";

type User = {
	userId: number;
	username: string;
	createdAt: string;
	isBot: boolean;
	isAdmin: boolean;
};

// remote user: @username@instance
// local user: username
export const getUser = async (host: string, username: string) => {
	const user = await ky<User>(
		`https://${host}/api/users/name/${username}`,
	).json();
	return user;
};
