# Golden Acceptance Criteria Examples

This document provides exemplar acceptance criteria for common story types, demonstrating best practices for writing clear, testable criteria.

## Search Feature Example

### Story

```
As a customer,
I want to search for products by keyword,
So that I can quickly find items I'm looking for.
```

### Acceptance Criteria

```gherkin
Feature: Product Search

Scenario: Search returns matching products
  Given products exist in the catalog:
    | name           | category    | price |
    | Blue T-Shirt   | Apparel     | 25.00 |
    | Blue Jeans     | Apparel     | 75.00 |
    | Red Sneakers   | Footwear    | 95.00 |
  When I search for "blue"
  Then I see 2 results
  And I see "Blue T-Shirt"
  And I see "Blue Jeans"
  And I do not see "Red Sneakers"

Scenario: Search is case-insensitive
  Given product "Blue T-Shirt" exists
  When I search for "BLUE"
  Then I see "Blue T-Shirt" in results

Scenario: Search with no results
  Given products exist in the catalog
  When I search for "xyz123nonexistent"
  Then I see "No results found for 'xyz123nonexistent'"
  And I see suggested categories or popular items

Scenario: Search with special characters
  Given product "Kids' Backpack" exists
  When I search for "kids'"
  Then I see "Kids' Backpack" in results
  And no error occurs

Scenario: Empty search
  Given I am on the product page
  When I submit the search form with empty input
  Then I see "Please enter a search term"
  And search is not executed

Scenario: Search result display
  Given I search for "shirt"
  When results are displayed
  Then each result shows:
    | element        | required |
    | Product image  | yes      |
    | Product name   | yes      |
    | Price          | yes      |
    | Rating         | no       |
  And results are sorted by relevance by default

Scenario: Search performance
  Given the catalog contains 100,000 products
  When I search for a common term
  Then results display within 500ms
```

## Form Validation Example

### Story

```
As a new user,
I want clear feedback when filling out the registration form,
So that I can correct mistakes and complete registration successfully.
```

### Acceptance Criteria

```gherkin
Feature: Registration Form Validation

# Email validation
Scenario: Valid email accepted
  Given I am on the registration page
  When I enter "user@example.com" in the email field
  And I move to the next field
  Then no error is displayed
  And the email field shows a green checkmark

Scenario: Invalid email format rejected
  Given I am on the registration page
  When I enter "invalidemail" in the email field
  And I move to the next field
  Then I see error "Please enter a valid email address"
  And the email field has a red border

Scenario: Duplicate email rejected
  Given "existing@example.com" is already registered
  When I enter "existing@example.com" in the email field
  And I move to the next field
  Then I see error "An account with this email already exists"
  And I see a link to login page

# Password validation
Scenario: Password meets requirements
  Given I am on the registration page
  When I enter "SecureP@ss123" as password
  Then I see password strength indicator show "Strong"
  And all requirement checkmarks are green

Scenario: Password too short
  Given I am on the registration page
  When I enter "Pass1!" as password
  Then I see "Password must be at least 8 characters"
  And "minimum 8 characters" requirement shows red X

Scenario: Password missing uppercase
  Given I am on the registration page
  When I enter "password123!" as password
  Then I see "uppercase letter" requirement shows red X
  And password strength shows "Weak"

Scenario: Password confirmation mismatch
  Given I entered password "SecureP@ss123"
  When I enter "DifferentPass123" in confirm password field
  And I move to the next field
  Then I see error "Passwords do not match"
  And confirm password field has red border

# Form submission
Scenario: Submit with validation errors
  Given I have validation errors on the form
  When I click "Create Account"
  Then form is not submitted
  And focus moves to first field with error
  And error summary appears at top of form

Scenario: Successful submission
  Given all form fields are valid
  When I click "Create Account"
  Then I see loading indicator
  And "Create Account" button is disabled
  And form submits successfully
```

## Shopping Cart Example

### Story

```
As a shopper,
I want to manage items in my cart,
So that I can review and adjust my order before checkout.
```

### Acceptance Criteria

```gherkin
Feature: Shopping Cart Management

Scenario: Add item to cart
  Given I am viewing product "Wireless Mouse"
  And my cart is empty
  When I click "Add to Cart"
  Then cart count shows "1"
  And I see confirmation "Wireless Mouse added to cart"
  And cart total reflects the item price

Scenario: Add same item increases quantity
  Given my cart contains 1 "Wireless Mouse"
  When I add "Wireless Mouse" again
  Then cart shows quantity 2 for "Wireless Mouse"
  And cart count shows "2"
  And cart total reflects 2 × item price

Scenario: Update item quantity
  Given my cart contains 2 "Wireless Mouse"
  When I change quantity to 5
  And I click "Update"
  Then cart shows quantity 5
  And cart total updates accordingly

Scenario: Quantity validation
  Given my cart contains "Wireless Mouse"
  When I enter quantity "0"
  Then I see error "Quantity must be at least 1"
  When I enter quantity "-1"
  Then I see error "Please enter a valid quantity"
  When I enter quantity "abc"
  Then I see error "Please enter a valid quantity"

Scenario: Remove item from cart
  Given my cart contains "Wireless Mouse" and "Keyboard"
  When I click "Remove" on "Wireless Mouse"
  Then "Wireless Mouse" is removed from cart
  And "Keyboard" remains in cart
  And cart count updates to "1"
  And I see "Wireless Mouse removed from cart"

Scenario: Empty cart state
  Given my cart is empty
  When I view my cart
  Then I see "Your cart is empty"
  And I see "Continue Shopping" button
  And checkout button is disabled

Scenario: Stock validation
  Given product "Limited Item" has only 3 in stock
  And my cart contains 2 "Limited Item"
  When I change quantity to 5
  Then I see error "Only 3 available"
  And quantity remains at 2

Scenario: Price change notification
  Given my cart contains "Wireless Mouse" at $29.99
  And the price changes to $34.99
  When I view my cart
  Then I see notification "Price changed for Wireless Mouse"
  And cart shows updated price $34.99
```

## File Upload Example

### Story

```
As a user,
I want to upload a profile picture,
So that my account has a personalized avatar.
```

### Acceptance Criteria

```gherkin
Feature: Profile Picture Upload

Scenario: Successful image upload
  Given I am on my profile settings page
  When I click "Upload Photo"
  And I select a valid image file (JPG, 500KB)
  Then I see image preview
  And I see "Save" and "Cancel" buttons
  When I click "Save"
  Then my profile picture is updated
  And I see success message "Profile picture updated"

Scenario: Supported file formats
  Given I am uploading a profile picture
  Then the following formats are accepted:
    | format | accepted |
    | JPG    | yes      |
    | JPEG   | yes      |
    | PNG    | yes      |
    | GIF    | no       |
    | BMP    | no       |
    | WebP   | yes      |

Scenario: File too large
  Given I am uploading a profile picture
  When I select a file larger than 5MB
  Then I see error "File size must be less than 5MB"
  And file is not uploaded
  And I see current file size in error message

Scenario: Invalid file type
  Given I am uploading a profile picture
  When I select a .pdf file
  Then I see error "Please upload an image file (JPG, PNG, or WebP)"
  And file is not uploaded

Scenario: Image cropping
  Given I have selected a valid image
  When the image preview appears
  Then I see a crop tool
  And I can adjust the crop area
  And I can zoom in/out
  And preview shows cropped result

Scenario: Upload progress
  Given I have selected a valid 4MB image
  When upload begins
  Then I see progress indicator
  And percentage complete is displayed
  And I can cancel the upload

Scenario: Upload error handling
  Given upload fails due to network error
  Then I see error "Upload failed. Please try again."
  And I see "Retry" button
  And my original profile picture is unchanged
```

## Notification Preferences Example

### Story

```
As a user,
I want to customize my notification preferences,
So that I only receive communications I'm interested in.
```

### Acceptance Criteria

```gherkin
Feature: Notification Preferences

Scenario: View current preferences
  Given I am on the notification settings page
  Then I see categories:
    | category         | description                    |
    | Order Updates    | Shipping and delivery status   |
    | Promotions       | Sales, deals, and offers       |
    | Account Alerts   | Security and account changes   |
    | Product Updates  | New features and releases      |
  And each category shows current setting (on/off)

Scenario: Toggle notification category
  Given "Promotions" notifications are ON
  When I toggle "Promotions" to OFF
  Then the toggle switches to OFF state
  And change is saved automatically
  And I see brief confirmation "Preference saved"

Scenario: Email vs Push notifications
  Given I am viewing notification preferences
  Then I can set separately for each channel:
    | category      | email | push |
    | Order Updates | on    | on   |
    | Promotions    | off   | on   |
  And each channel can be toggled independently

Scenario: Unsubscribe from all
  Given I am on notification preferences
  When I click "Unsubscribe from all"
  Then I see confirmation dialog
  And dialog warns about important notifications
  When I confirm
  Then all optional notifications are disabled
  And "Account Alerts" remains enabled (required)

Scenario: Required notifications cannot be disabled
  Given "Account Alerts" is a required category
  When I try to disable "Account Alerts"
  Then toggle is disabled
  And I see tooltip "Required for account security"

Scenario: Preferences persist across sessions
  Given I set "Promotions" to OFF
  And I log out
  When I log back in
  And I view notification preferences
  Then "Promotions" is still OFF
```

## Best Practices Summary

### DO

- Use Given-When-Then format consistently
- Cover happy path, error cases, and edge cases
- Be specific and measurable
- Include data examples where helpful
- Test one behavior per scenario
- Write scenarios that can be automated

### DON'T

- Use vague terms like "appropriate" or "user-friendly"
- Include implementation details
- Write compound scenarios testing multiple behaviors
- Skip error handling scenarios
- Forget accessibility considerations
- Write untestable criteria

## Related Documents

- Acceptance Criteria Standards
- User Story Writing Playbook
- Definition of Ready
