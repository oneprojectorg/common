# tRPC Router Structure

📌 **account**

```
├─ getMyAccount `🔍 query`
├─ getUserProfiles `🔍 query`
├─ login `🔍 query`
├─ listMatchingDomainOrganizations `🔍 query`
├─ switchProfile `✏️ mutation`
├─ switchOrganization `✏️ mutation`
├─ updateUserProfile `✏️ mutation`
├─ uploadImage `✏️ mutation`
├─ uploadBannerImage `✏️ mutation`
├─ usedStorage `🔍 query`
└─ usernameAvailable `🔍 query`
```

📌 **organization**

```
├─ list `🔍 query`
├─ getBySlug `🔍 query`
├─ getOrganizationsByProfile `🔍 query`
├─ listUsers `🔍 query`
├─ listPosts `🔍 query`
├─ listAllPosts `🔍 query`
├─ listPendingRelationships `🔍 query`
├─ search `🔍 query`
├─ checkMembership `🔍 query`
├─ getRoles `🔍 query`
├─ getStats `🔍 query`
├─ create `✏️ mutation`
├─ createPost `✏️ mutation`
├─ update `✏️ mutation`
├─ deletePost `✏️ mutation`
├─ addRelationship `✏️ mutation`
├─ approveRelationship `✏️ mutation`
├─ declineRelationship `✏️ mutation`
├─ removeRelationship `✏️ mutation`
├─ join `✏️ mutation`
├─ invite `✏️ mutation`
├─ uploadAvatarImage `✏️ mutation`
├─ updateOrganizationUser `✏️ mutation`
├─ deleteOrganizationUser `✏️ mutation`
└─ addReaction `✏️ mutation`
```

📌 **individual**

```
└─ getTerms `🔍 query`
```

📌 **profile**

```
├─ list `🔍 query`
├─ search `🔍 query`
├─ addRelationship `🔍 query`
└─ invite `✏️ mutation`
```

📌 **llm**

```
└─ chat `✏️ mutation`
```

📌 **taxonomy**

```
├─ getGeoNames `🔍 query`
└─ getTerms `🔍 query`
```

📌 **content**

```
└─ linkPreview `🔍 query`
```

📌 **comments**

```
├─ createComment `✏️ mutation`
├─ updateComment `✏️ mutation`
├─ deleteComment `✏️ mutation`
└─ getComments `🔍 query`
```

📌 **posts**

```
├─ createPost `✏️ mutation`
├─ getPost `🔍 query`
├─ getPosts `🔍 query`
├─ getOrganizationPosts `🔍 query`
└─ uploadPostAttachment `✏️ mutation`
```

📌 **decision**

```
├─ 📦 instances
  │ ├─ createInstance `✏️ mutation`
  │ ├─ updateInstance `✏️ mutation`
  │ ├─ listInstances `🔍 query`
  │ ├─ getInstance `🔍 query`
  │ └─ getCategories `🔍 query`
├─ 📦 processes
  │ ├─ createProcess `✏️ mutation`
  │ ├─ getProcess `🔍 query`
  │ └─ listProcesses `🔍 query`
├─ 📦 proposals
  │ ├─ createProposal `✏️ mutation`
  │ ├─ getProposal `🔍 query`
  │ ├─ listProposals `🔍 query`
  │ ├─ updateProposal `✏️ mutation`
  │ ├─ updateProposalStatus `✏️ mutation`
  │ ├─ deleteProposal `✏️ mutation`
  │ ├─ export `✏️ mutation`
  │ └─ getExportStatus `🔍 query`
├─ 📦 results
  │ ├─ getInstanceResults `🔍 query`
  │ └─ getResultsStats `🔍 query`
├─ 📦 transitions
  │ ├─ checkTransitions `🔍 query`
  │ └─ executeTransition `✏️ mutation`
└─ 🔧 other
    ├─ uploadProposalAttachment `✏️ mutation`
    └─ submitVote `✏️ mutation`
```

📌 **platform**

```
├─ 📦 root
│   └─ getStats `🔍 query`
└─ 📦 admin
    ├─ listAllUsers `🔍 query`
    ├─ addUsersToOrganization `✏️ mutation`
    └─ updateUserProfile `✏️ mutation`
```

## Summary

- **🔍 query** - read-only operations
- **✏️ mutation** - write operations (create, update, delete, etc.)
- **96 total procedures** across 12 main routers
- **65 queries** and **31 mutations**
