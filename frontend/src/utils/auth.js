// src/utils/auth.js

export const getUser = () => {
    const user = localStorage.getItem("user");
    try {
        return user ? JSON.parse(user) : null;
    } catch (e) {
        return null;
    }
};

export const setToken = (token, user) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
};

export const removeToken = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
};