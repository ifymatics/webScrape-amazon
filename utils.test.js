const utils = require("./utils");

describe("Utils", () => {
  it("getRating should return a number or floating number if valid rating string is supplied", () => {
    // TODO - write the unit test here
    const rating = utils.getRating("4.4 out of 5 stars");
    expect(rating).toBe(4.4);
  });
  it("getRating should return null if an invalid rating string is supplied", () => {
    const rating = utils.getRating("four out of 5 stars");
    expect(rating).toBe(null);
  });
  it("getRating should return null if no rating string is supplied", () => {
    const rating = utils.getRating();
    expect(rating).toBe(null);
  });
});
