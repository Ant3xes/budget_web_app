/** Escapes the LIKE wildcards (and the escape character) of a user search term (issue 163). */
export const escapeLike = (term: string) => term.replace(/[\\%_]/g, "\\$&");
